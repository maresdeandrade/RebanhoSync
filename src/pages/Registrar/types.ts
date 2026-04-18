export type RegistrarSexo = "M" | "F";

export interface CompraNovoAnimalDraft {
  localId: string;
  identificacao: string;
  sexo: RegistrarSexo;
  dataNascimento: string;
  pesoKg: string;
}
