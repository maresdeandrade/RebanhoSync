import { ShieldCheck } from "lucide-react";

import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
import { OfficialSanitaryPackManager } from "@/components/sanitario/OfficialSanitaryPackManager";
import { RegulatoryOverlayManager } from "@/components/sanitario/RegulatoryOverlayManager";
import { useAuth } from "@/hooks/useAuth";
import { useProtocolosData } from "@/pages/ProtocolosSanitarios/helpers/useProtocolosData";

const ProtocolosSanitarios = () => {
  const { activeFarmId, farmExperienceMode, role } = useAuth();
  const canManageProtocols = role === "manager" || role === "owner";
  const { catalogProducts, protocolosExistentes, protocolosItensExistentes } =
    useProtocolosData({ activeFarmId });

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
          Estrutura sanitaria animal-centric com tres camadas claras. Pack
          oficial = o que sua fazenda precisa cumprir. Template canonico =
          modelos padrao recomendados pelo sistema. Customizado = como sua
          fazenda escolhe operar sem recriar, em paralelo, o mesmo tronco
          obrigatorio ja coberto pelo pack oficial.
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
          catalogProducts={catalogProducts}
          protocols={protocolosExistentes}
          protocolItems={protocolosItensExistentes}
          canManage={canManageProtocols}
        />
      ) : null}
    </div>
  );
};

export default ProtocolosSanitarios;
