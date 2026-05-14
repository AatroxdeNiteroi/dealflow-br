import { AnimatePresence, motion } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuemSomosModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

            <div className="modal-body modal-body--lg">
              <div className="quem-eyebrow">Quem somos · DealFlow BR</div>

              <div className="metodologia-hero">
                Inteligência de mercado privado<br />
                <em>feita por brasileiros.</em>
              </div>

              <p className="metodologia-text">
                O DealFlow BR nasceu de conversas com gestores de fundos de
                investimento, profissionais de M&amp;A e family offices.
                Sempre a mesma frustração nos vinha à mesa: o mercado de
                sociedades limitadas brasileiras é estruturalmente opaco, e
                as ferramentas disponíveis — bureaus pagos com faixas sem
                proveniência — não atendiam a um padrão analítico que se
                possa defender em um comitê de investimento.
              </p>

              <div className="metodologia-statement">
                Decidimos construir o que faltava.
              </div>

              <p className="metodologia-text">
                Acreditamos que o capital flui melhor quando o mercado
                enxerga melhor — e que a opacidade artificial sobre
                empresas privadas brasileiras é um atrito ineficiente da
                nossa economia. Empresas saudáveis em busca de sucessão
                merecem ser encontradas antes de fecharem por ausência de
                comprador. Investidores qualificados merecem ferramentas à
                altura. E o ecossistema empresarial brasileiro — base da
                geração de empregos no país — merece tese de investimento
                construída com rigor, não com palpite.
              </p>

              <p className="metodologia-text">
                Os dados que sustentam essa inteligência já existem —{" "}
                <strong>públicos, oficiais, gratuitos</strong> — aguardando
                alguém disposto a tratá-los com o rigor de quem entende
                tanto o mercado quanto a estrutura jurídica que o rege.
              </p>

              <div className="founders-grid">
                <div className="founder">
                  <div className="founder-role">Mercado · Modelagem</div>
                  <h5 className="founder-nome">
                    Rafael <em>Sobreiro Couto</em>
                  </h5>
                  <div className="founder-formacao">Economia · UFF</div>
                  <p className="founder-bio">
                    Versado em análise mercadológica e financeira, Rafael
                    desenhou a tese e a modelagem do negócio. Da definição
                    do universo de empresas-alvo às razões setoriais que
                    sustentam a reconstrução de receita, a arquitetura
                    analítica do produto partiu dele — quem traduz
                    intuição de mercado em formulação operacional.
                  </p>
                </div>
                <div className="founder">
                  <div className="founder-role">Jurídico · Arquitetura</div>
                  <h5 className="founder-nome">
                    Daniel <em>Martins Gomes</em>
                  </h5>
                  <div className="founder-formacao">Direito · UFF</div>
                  <p className="founder-bio">
                    Head jurídico e arquiteto técnico, Daniel construiu a
                    espinha dorsal do produto: a infraestrutura que cruza
                    fontes públicas, pseudonimiza identidades, opera dentro
                    dos limites da LGPD e materializa em código a
                    metodologia técnica. Onde o produto é defensável, ele
                    desenhou a defesa.
                  </p>
                </div>
              </div>

              <p className="metodologia-text">
                As fórmulas, os <em>archetypes</em>, os níveis de
                confiança, o tratamento de dados pseudonimizados, a
                metodologia técnica versionada — todas as decisões
                substantivas emergiram do diálogo entre quem entende o
                mercado e quem entende a estrutura. Essa intersecção,
                acreditamos, é o único caminho honesto para fazer
                inteligência de mercado privado no Brasil.
              </p>

              <p className="metodologia-closing">
                Um produto de fundadores,<br />
                <em>com convicção e método.</em>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
