import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildF6Enablement } from "../../scripts/codex/prepare-sanitario-f6-enablement.mjs";
const read = name => JSON.parse(readFileSync("docs/review/evidence/"+name,"utf8"));
const rows=read("SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json").snapshot.rows;
const matrix=read("SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json");
describe("Prontidão F6 por regra/finalidade, sem autorização remota",()=>{
 it("não exige todas as finalidades ou apresentações para avaliar carne independente",()=>{
   const result=buildF6Enablement(rows,matrix);
   expect(result.counts).toEqual({ELEGIVEL:1,RESTRITO:17,INCOMPLETO:62});
   expect(result.rows.find(r=>r.code==="P11"&&r.purpose==="meat")).toMatchObject({state:"ELEGIVEL",reasons:[],currently_enabled:false});
   expect(result.rows.find(r=>r.code==="P11"&&r.purpose==="milk").state).toBe("RESTRITO");
   expect(new Set(result.rows.map(r=>r.code)).size).toBe(39);
 });
 it("divergência leiteira não bloqueia carne por esse motivo; cancelamento comprovado é específico",()=>{
   const result=buildF6Enablement(rows,matrix);
   expect(result.rows.filter(r=>r.code==="P33"&&r.purpose==="meat").every(r=>!r.reasons.includes("divergencia_material_milk"))).toBe(true);
   for(const code of ["P03","P16","P25"])expect(result.rows.filter(r=>r.code===code).every(r=>r.state==="RESTRITO")).toBe(true);
   expect(result.rows.filter(r=>r.code==="P06").every(r=>!r.reasons.includes("registro_individual_cancelado"))).toBe(true);
 });
 it("vínculo errado ou ausente impede prontidão; nenhuma regra é promovida",()=>{
   const copy=structuredClone(rows), before=structuredClone(rows);
   const result=buildF6Enablement(rows,matrix);
   expect(rows).toEqual(before);
   expect(result.rows.every(r=>r.currently_enabled===false)).toBe(true);
   copy.sanitario_produto_carencia_fontes_v2=[];
   expect(buildF6Enablement(copy,matrix).rows.find(r=>r.code==="P11"&&r.purpose==="meat").state).toBe("INCOMPLETO");
 });
});
