import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldCheck } from "lucide-react";

import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
import { OfficialSanitaryPackManager } from "@/components/sanitario/OfficialSanitaryPackManager";
import { RegulatoryOverlayManager } from "@/components/sanitario/RegulatoryOverlayManager";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { refreshVeterinaryProductsCatalog } from "@/lib/sanitario/products";

const ProtocolosSanitarios = () => {
  const { activeFarmId, farmExperienceMode, role } = useAuth();
  const canManageProtocols = role === "manager" || role === "owner";

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(
      activeFarmId,
      [
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      { mode: "merge" },
    ).catch((error) => {
      console.warn("[protocolos-sanitarios] failed to refresh protocols", error);
    });
  }, [activeFarmId]);

  useEffect(() => {
    refreshVeterinaryProductsCatalog().catch((error) => {
      console.warn(
        "[protocolos-sanitarios] failed to refresh veterinary products",
        error,
      );
    });
  }, []);

  const catalogProducts = useLiveQuery(() => {
    return db.catalog_produtos_veterinarios.orderBy("nome").toArray();
  }, []);

  const protocolosExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((protocol) => !protocol.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const protocolosItensExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_protocolos_sanitarios_itens
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  return (
    <div className="container mx-auto space-y-6 pb-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Protocolos Sanitarios
          </h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Estrutura sanitaria animal-centric com tres camadas claras: base
          regulatoria oficial, overlay operacional de conformidade e protocolos
          operacionais ativos da fazenda. Os templates canonicos reutilizaveis
          agora vivem dentro da camada operacional da fazenda, sem biblioteca
          paralela.
        </p>
        {!canManageProtocols ? (
          <p className="text-sm text-muted-foreground">
            Seu perfil esta em modo leitura para protocolos. Edicao estrutural e
            liberada para manager e owner.
          </p>
        ) : null}
      </div>

      {activeFarmId ? (
        <OfficialSanitaryPackManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {activeFarmId ? (
        <RegulatoryOverlayManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {activeFarmId ? (
        <FarmProtocolManager
          activeFarmId={activeFarmId}
          farmExperienceMode={farmExperienceMode}
          catalogProducts={catalogProducts ?? []}
          protocols={protocolosExistentes ?? []}
          protocolItems={protocolosItensExistentes ?? []}
          canManage={canManageProtocols}
        />
      ) : null}
    </div>
  );
};

export default ProtocolosSanitarios;
