const axios = require('axios');
const cheerio = require('cheerio');

// Configuração de Headers para evitar bloqueios de scraping (User-Agent)
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
};

/**
 * Módulo para buscar informações da Natura
 */
async function obterDadosNatura(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);

    // Extração via meta tags estruturadas (Open Graph / JSON-LD)
    const titulo = $('meta[property="og:title"]').attr('content') || $('h1').text().trim();
    const precoTexto = $('meta[property="product:price:amount"]').attr('content') || 
                       $('.price, [class*="price"]').first().text();

    const preco = precoTexto ? parseFloat(precoTexto.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;

    return { marca: 'Natura', produto: titulo, preco: preco, status: 'sucesso' };
  } catch (error) {
    console.error(`Erro ao atualizar Natura (${url}):`, error.message);
    return { marca: 'Natura', status: 'erro', mensagem: error.message };
  }
}

/**
 * Módulo para buscar informações da Eudora / O Boticário (Grupo Boticário)
 */
async function obterDadosGrupoBoticario(url, marcaNome) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);

    // Tenta encontrar a estrutura de dados JSON-LD embutida na página
    let preco = null;
    let titulo = $('h1').text().trim();

    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const json = JSON.parse($(element).html());
        if (json['@type'] === 'Product' || json['name']) {
          titulo = json.name || titulo;
          if (json.offers) {
            preco = parseFloat(json.offers.price || json.offers[0]?.price);
          }
        }
      } catch (e) {
        // Ignora erros de parse de JSONs irrelevantes
      }
    });

    // Fallback caso o JSON-LD não esteja disponível
    if (!preco) {
      const precoTexto = $('[class*="sales-price"], [class*="price"]').first().text();
      preco = precoTexto ? parseFloat(precoTexto.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;
    }

    return { marca: marcaNome, produto: titulo, preco: preco, status: 'sucesso' };
  } catch (error) {
    console.error(`Erro ao atualizar ${marcaNome} (${url}):`, error.message);
    return { marca: marcaNome, status: 'erro', mensagem: error.message };
  }
}

/**
 * Função Principal: Identifica a marca pela URL e redireciona para a atualização correta
 */
async function atualizarProdutoPorUrl(url) {
  if (url.includes('natura.com.br')) {
    return await obterDadosNatura(url);
  } else if (url.includes('eudora.com.br')) {
    return await obterDadosGrupoBoticario(url, 'Eudora');
  } else if (url.includes('boticario.com.br')) {
    return await obterDadosGrupoBoticario(url, 'O Boticário');
  } else {
    throw new Error('Marca ou site não suportado atualmente.');
  }
}

/**
 * Exemplo de Execução / Lote de Atualização
 */
async function executarAtualizacaoDePrecos(listaDeProdutos) {
  console.log('Iniciando atualização de preços...\n');
  
  const resultados = [];
  for (const item of listaDeProdutos) {
    console.log(`Buscando dados para: ${item.url}`);
    const dadosAtualizados = await atualizarProdutoPorUrl(item.url);
    
    resultados.push({
      id: item.id,
      url: item.url,
      ...dadosAtualizados,
      atualizadoEm: new Date().toISOString()
    });
  }

  console.log('\n--- Resultado Final da Atualização ---');
  console.log(JSON.stringify(resultados, null, 2));
  return resultados;
}

// --- TESTE PRÁTICO ---
const produtosParaAtualizar = [
  { id: 1, url: 'https://www.natura.com.br/p/perfume-exemplo/12345' },
  { id: 2, url: 'https://www.eudora.com.br/p/batom-exemplo/67890' }
];

// executarAtualizacaoDePrecos(produtosParaAtualizar);
