/** Mapeia o slug da rota dinâmica `/cadastros/[entity]` para metadados de display. */
export const CADASTROS_META: Record<string, { title: string; description: string; icon: string }> = {
  transportadoras: { title: "Transportadoras", description: "Empresas parceiras de transporte", icon: "🚚" },
  motoristas: { title: "Motoristas", description: "Cadastro de motoristas vinculados às transportadoras", icon: "👤" },
  veiculos: { title: "Veículos", description: "Cavalos, carretas e capacidades", icon: "🚛" },
  produtores: { title: "Produtores", description: "Produtores rurais / fornecedores dos contratos", icon: "🌾" },
  clientes: { title: "Clientes Compradores", description: "Compradores finais (exportadoras, indústrias)", icon: "🏭" },
  terminais: { title: "Terminais e Armazéns", description: "Terminais portuários, armazéns e pontos de entrega", icon: "🏗️" },
  locais: { title: "Locais", description: "Fazendas, armazéns de origem, destinos — reutilizáveis em contratos e cargas", icon: "📍" },
  produtos: { title: "Produtos", description: "Catálogo de produtos transportados", icon: "📦" },
};

export const CONFIG_META: Record<string, { title: string; description: string; icon: string }> = {
  usuarios: { title: "Usuários", description: "Gestão de usuários e vínculo com empresas", icon: "👥" },
  permissoes: { title: "Permissões", description: "Matriz de permissões por perfil × módulo × ação", icon: "🔐" },
};
