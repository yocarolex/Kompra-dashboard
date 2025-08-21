let clientsData = [];
        let historicalData = [];
        
        // Carregar dados do Excel
        document.getElementById('excelFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    processExcelData(jsonData);
                    document.getElementById('lastUpdate').textContent = `Última atualização: ${new Date().toLocaleString('pt-BR')}`;
                } catch (error) {
                    alert('Existem restaurantes sem pedidos');
                }
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('searchBox').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredClients = clientsData.filter(client =>
        client.nome.toLowerCase().includes(searchTerm)
    );    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Última atualização: ${new Date().toLocaleString('pt-BR')}`;
    }    function checkRedFlags(client) {
        const flags = [];
    
        // Sem pedidos há mais de 15 dias
        if (client.ultimo_pedido && client.pedidos_mes > 0) {
            const daysSinceLastOrder = (new Date() - client.ultimo_pedido) / (1000 * 60 * 60 * 24);
            if (daysSinceLastOrder > 15) {
                flags.push('Sem pedidos há mais de 15 dias');
            }
        }
    
        // 0 pedidos no mês OU valor transacionado 0 ou null
        if (
            client.pedidos_mes === 0 ||
            client.valor_transacionado === 0 ||
            client.valor_transacionado === null
        ) {
            flags.push('0 pedidos no mês');
        }
    
        // Fornecedores não responderam acima de 30% (mostrar valor exato)
        if (client.fornecedores_nao_responderam > 30) {
            flags.push(`Fornecedores não responderam: ${client.fornecedores_nao_responderam.toFixed(1)}%`);
        }
    
        // Economia abaixo de 1%
        if (client.economia_alcancada < 0.01) {
            flags.push('Economia abaixo de 1%');
        }
    
        return flags;
    }
    renderClientsTable(filteredClients);
});

// Função para renderizar a tabela de clientes
function renderClientsTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">Nenhum restaurante encontrado.</div>';
        return;
    }
    // Monte sua tabela aqui usando os dados filtrados
    // Exemplo simples:
    let html = '<table><tr><th>Restaurante</th><th>Pedidos</th></tr>';
    data.forEach(client => {
        html += `<tr><td>${client.nome}</td><td>${client.pedidos_semana}</td></tr>`;
    });
    html += '</table>';
    tableContainer.innerHTML = html;
}
        
        // Processar dados do Excel
        function processExcelData(data) {
            clientsData = data.map(row => {
                // Tratar valor monetário
                let valorStr = row['Transacionado/Comprado (R$)'] || '';
                if (typeof valorStr === 'string') {
                    valorStr = valorStr.replace(/R\$|\s/g, '').replace(/\./g, '').replace(/,/g, '.');
                }
                const valorTransacionado = parseFloat(valorStr) || 0;

                // Aceitar "Pedidos" ou "Pedidos (por mês)"
                const pedidosRaw = row.Pedidos !== undefined ? row.Pedidos : row['Pedidos (por mês)'];

                // Função para validar datas (serial Excel, dd/mm/yyyy, yyyy-mm-dd)
                function parseValidDate(value) {
                    if (!value) return null;
                    // Se for número (serial Excel)
                    if (typeof value === 'number') {
                        // Excel: dias desde 1/1/1900, mas JS conta desde 1/1/1970
                        // 25569 é o número de dias entre 1/1/1900 e 1/1/1970
                        const jsDate = new Date((value - 25569) * 86400 * 1000);
                        if (isNaN(jsDate.getTime())) return null;
                        return jsDate;
                    }
                    // Se for string no formato dd/mm/yyyy
                    if (typeof value === 'string') {
                        // Tenta dd/mm/yyyy
                        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (match) {
                            const day = parseInt(match[1], 10);
                            const month = parseInt(match[2], 10) - 1;
                            const year = parseInt(match[3], 10);
                            const d = new Date(year, month, day);
                            if (!isNaN(d.getTime())) return d;
                        }
                        // Tenta ISO ou outros formatos
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) return d;
                    }
                    return null;
                }


                // Função para tratar valores percentuais (aceita "47,84%", "47.84", 47.84, etc)
                function parsePercent(val) {
                    if (typeof val === 'string') {
                        let clean = val.replace('%','').replace(',','.').trim();
                        let num = parseFloat(clean);
                        if (isNaN(num)) return 0;
                        return num;
                    }
                    if (typeof val === 'number') return val;
                    return 0;
                }

                const client = {
                    id: row.Id || '',
                    nome: (row.Restaurante !== undefined && row.Restaurante !== null) ? String(row.Restaurante) : '',
                    usuarios: parseInt(row.Usuários) || 0,
                    pedidos_mes: parseInt(pedidosRaw) || 0,
                    valor_transacionado: valorTransacionado,
                    fornecedores_nao_responderam: parsePercent(row['Fornecedores não responderam (%)']) || 0,
                    quotacoes: parseInt(row.Quotações) || 0,
                    economia_alcancada: parsePercent(row['Economia (%)']) / 100 || 0,
                    performance: parsePercent(row['Performance (%)']) || 0,
                    erros_cotacao: parseInt(row['Erros de Cotação']) || 0,
                    link_ultimo_pedido: row['Link Ult. Pedido'] || '',
                    status_ultimo_pedido: row['Status Ult. Pedido'] || '',
                    ultimo_pedido: parseValidDate(row['Último pedido']),
                    ultimo_acesso: parseValidDate(row['Último acesso']),
                    ultima_alteracao_estoque: parseValidDate(row['Última alteração de estoque']),
                    contacted: false,
                    followup_scheduled: null,
                    contact_history: []
                };

                // Calcular Health Score
                client.health_score = calculateHealthScore(client);
                client.classification = getScoreClassification(client.health_score);
                client.red_flags = checkRedFlags(client);
                client.responsible = getResponsible(client.health_score, client.red_flags);

                return client;
            });

            updateDashboard();
            showAlerts();
        }
        
        // Converter valores textuais
        function convertRespostaCliente(value) {
            if (value === 'Nunca' || value === 0) return 0;
            if (value === 'Às vezes' || value === 1) return 5;
            if (value === 'Sempre' || value === 2) return 10;
            return 0;
        }
        
        function convertSatisfacao(value) {
            if (value === 'Insatisfeito' || value === 'Não satisfeito' || value === 0) return 0;
            if (value === 'Neutro' || value === 1 || value === 'Nunca falou nada') return 5;
            if (value === 'Satisfeito' || value === 2 || value === 'Já falou que está satisfeito') return 10;
            return 5; // Padrão para "Nunca falou nada"
        }
        
        // Calcular Health Score
        function calculateHealthScore(client) {
            let score = 0;
            // Uso da plataforma (0 - 40 pontos)
            // Pedidos por mês (0 - 20 pontos)
            let pedidosScore = 0;
            if (client.pedidos_mes === 0) pedidosScore = 0;
            else if (client.pedidos_mes === 1) pedidosScore = 5;
            else if (client.pedidos_mes === 2) pedidosScore = 10;
            else if (client.pedidos_mes === 3) pedidosScore = 15;
            else if (client.pedidos_mes >= 4) pedidosScore = 20;
            score += pedidosScore;

            // Valor transacionado (0 a 10 pontos)
            let valorScore = 0;
            if (client.valor_transacionado <= 5000) valorScore = 0;
            else if (client.valor_transacionado <= 30000) valorScore = 5;
            else valorScore = 10;
            score += valorScore;

            // Funcionalidades utilizadas (5 - 10 pontos)
            // Só kompra: 5 pontos, Kompra + Estoque: 10 pontos
            let funcScore = client.ultima_alteracao_estoque ? 10 : 5;
            score += funcScore;

            // Engajamento (0 - 15 pontos)
            // Taxa de respostas dos fornecedores (0 - 15 pontos)
            // Regra: 0 a 40% - 0; 41% a 60% - 5; 61% a 80% - 10; acima de 81% - 15
            let respostaScore = 0;
            const taxa_resposta = 100 - (client.fornecedores_nao_responderam);
            if (taxa_resposta >= 0 && taxa_resposta <= 40) respostaScore = 0;
            else if (taxa_resposta >= 41 && taxa_resposta <= 60) respostaScore = 5;
            else if (taxa_resposta >= 61 && taxa_resposta <= 80) respostaScore = 10;
            else if (taxa_resposta >= 81) respostaScore = 15;
            score += respostaScore;

            // Resultados (0 - 45 pontos)
            // Economia alcançada (0 -10 pontos)
            let economiaScore = 0;
            // 0 a 1% - 0; 2% a 4% - 3; 5% a 7% - 7; acima de 8% - 10
            const economia = client.economia_alcancada * 100;
            if (economia >= 0 && economia <= 1) economiaScore = 0;
            else if (economia >= 2 && economia <= 4) economiaScore = 3;
            else if (economia >= 5 && economia <= 7) economiaScore = 7;
            else if (economia > 8) economiaScore = 10;
            score += economiaScore;

            // NPS (0 - 35 pontos)
            // nota de 0 a 5  - 0 pontos
            // nota de 6 a 7 -15 pontos
            // nota de 8 a 9 - 30 pontos
            // nota 10 - 35 pontos
            let npsScore = 0;
            if (client.satisfacao_declarada >= 0 && client.satisfacao_declarada <= 5) npsScore = 0;
            else if (client.satisfacao_declarada >= 6 && client.satisfacao_declarada <= 7) npsScore = 15;
            else if (client.satisfacao_declarada >= 8 && client.satisfacao_declarada <= 9) npsScore = 30;
            else if (client.satisfacao_declarada === 10) npsScore = 35;
            score += npsScore;

            // Limitar entre 0 e 100
            const finalScore = Math.min(100, Math.max(0, score));
            return finalScore;
        }
        
        // Classificar score
        function getScoreClassification(score) {
            if (score >= 85) return 'verde';
            if (score >= 70) return 'azul';
            if (score >= 50) return 'laranja';
            return 'vermelho';
        }
        
        // Definir responsável
        function getResponsible(score, redFlags) {
            // Verificar se tem red flag de fornecedores - responsável Jessica
            const hasSupplierIssue = redFlags.some(flag => 
                flag.includes('Fornecedores') || flag.includes('fornecedores')
            );
            
            if (hasSupplierIssue) return 'Jessica';
            
            // Regras normais baseadas no score
            if (score < 50) return 'Gabriel';
            if (score < 70) return 'João';
            return 'CS Team';
        }
        
        // Verificar red flags
        function checkRedFlags(client) {
            const flags = [];
            
            // Sem pedidos há mais de 15 dias
            if (client.ultimo_pedido) {
                const daysSinceLastOrder = (new Date() - client.ultimo_pedido) / (1000 * 60 * 60 * 24);
                if (daysSinceLastOrder > 15) {
                    flags.push('Sem pedidos há mais de 15 dias');
                }
            } else if (!client.ultimo_pedido && (!client.pedidos_mes || client.pedidos_mes === 0)) {
                // Só alerta se não houver data de último pedido E pedidos_mes for 0 ou falsy
                flags.push('0 pedidos no mês');
            }
            
            // Fornecedores não responderam acima de 30%
            if (client.fornecedores_nao_responderam > 30) {
                flags.push('Fornecedores não responderam > 30%');
            }
            
            // Economia abaixo de 1%
            if (client.economia_alcancada < 0.01) {
                flags.push('Economia abaixo de 1%');
            }
            
            return flags;
        }
        
        // Atualizar dashboard
        function updateDashboard() {
            console.log('Atualizando dashboard com', clientsData.length, 'clientes');
            updateStats();
            updateTable();
            updateCharts();
        }
        
        // Atualizar estatísticas
        function updateStats() {
            const stats = {
                verde: clientsData.filter(c => c.classification === 'verde').length,
                azul: clientsData.filter(c => c.classification === 'azul').length,
                laranja: clientsData.filter(c => c.classification === 'laranja').length,
                vermelho: clientsData.filter(c => c.classification === 'vermelho').length
            };
            
            const total = clientsData.length;
            
            // Estatísticas por classificação com verificação de existência
            const elVerdeCount = document.getElementById('verdeCount');
            if (elVerdeCount) elVerdeCount.textContent = stats.verde;
            const elAzulCount = document.getElementById('azulCount');
            if (elAzulCount) elAzulCount.textContent = stats.azul;
            const elLaranjaCount = document.getElementById('laranjaCount');
            if (elLaranjaCount) elLaranjaCount.textContent = stats.laranja;
            const elVermelhoCount = document.getElementById('vermelhoCount');
            if (elVermelhoCount) elVermelhoCount.textContent = stats.vermelho;
            
            if (total > 0) {
                document.getElementById('verdeProgress').style.width = `${(stats.verde / total) * 100}%`;
                document.getElementById('azulProgress').style.width = `${(stats.azul / total) * 100}%`;
                document.getElementById('laranjaProgress').style.width = `${(stats.laranja / total) * 100}%`;
                document.getElementById('vermelhoProgress').style.width = `${(stats.vermelho / total) * 100}%`;
            }
            
            // Somatórias e médias mensais
            if (clientsData.length > 0) {
                // Total de pedidos
                const totalPedidos = clientsData.reduce((sum, client) => {
                    const pedidos = Number(client.pedidos_mes) || 0;
                    return sum + pedidos;
                }, 0);
                
                // Total transacionado
                const totalTransacionado = clientsData.reduce((sum, client) => {
                    const valor = Number(client.valor_transacionado) || 0;
                    return sum + valor;
                }, 0);
                
                // Média de economia
                const economias = clientsData.map(client => Number(client.economia_alcancada) || 0).filter(e => e > 0);
                const mediaEconomia = economias.length > 0 ? economias.reduce((sum, e) => sum + e, 0) / economias.length : 0;
                
                // Média de fornecedores não responderam
                const fornecedores = clientsData.map(client => Number(client.fornecedores_nao_responderam) || 0);
                const mediaFornecedores = fornecedores.length > 0 ? fornecedores.reduce((sum, f) => sum + f, 0) / fornecedores.length : 0;
                
                // Média de performance (apenas restaurantes com pelo menos 1 pedido)
                const perfClients = clientsData.filter(client => client.pedidos_mes > 0);
                const mediaPerformance = perfClients.length > 0
                    ? perfClients.reduce((sum, client) => sum + (Number(client.performance) || 0), 0) / perfClients.length
                    : 0;
                
                // Atualizar displays com verificação de existência
                const elTotalPedidos = document.getElementById('totalPedidos');
                if (elTotalPedidos) elTotalPedidos.textContent = totalPedidos.toLocaleString('pt-BR');
                const elTotalTransacionado = document.getElementById('totalTransacionado');
                if (elTotalTransacionado) elTotalTransacionado.textContent = totalTransacionado.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                const elMediaEconomia = document.getElementById('mediaEconomia');
                if (elMediaEconomia) elMediaEconomia.textContent = (mediaEconomia * 100).toFixed(1) + '%';
                const elMediaFornecedores = document.getElementById('mediaFornecedores');
                if (elMediaFornecedores) elMediaFornecedores.textContent = mediaFornecedores.toFixed(1) + '%';
                const elMediaPerformance = document.getElementById('mediaPerformance');
                if (elMediaPerformance) elMediaPerformance.textContent = mediaPerformance.toFixed(1) + '%';
                
                console.log('Estatísticas calculadas:', {
                    totalPedidos,
                    totalTransacionado,
                    mediaEconomia,
                    mediaFornecedores
                });
            } else {
                document.getElementById('totalPedidos').textContent = '0';
                document.getElementById('totalTransacionado').textContent = 'R$ 0';
                document.getElementById('mediaEconomia').textContent = '0%';
                document.getElementById('mediaFornecedores').textContent = '0%';
            }
        }
        
        // Atualizar tabela
        function updateTable() {
            let filteredData = [...clientsData];
            
            console.log('UpdateTable chamado com', filteredData.length, 'clientes');
            
            // Aplicar filtros
            const searchTerm = document.getElementById('searchBox').value.toLowerCase();
            const scoreFilter = document.getElementById('scoreFilter').value;
            const responsibleFilter = document.getElementById('responsibleFilter').value;
            
            if (searchTerm) {
                filteredData = filteredData.filter(c => 
                    c.nome.toLowerCase().includes(searchTerm)
                );
            }
            
            if (scoreFilter) {
                // Corrige filtro para 'azul' (case-insensitive)
                if (scoreFilter.toLowerCase() === 'azul') {
                    filteredData = filteredData.filter(c => c.classification && c.classification.toLowerCase() === 'azul');
                } else {
                    filteredData = filteredData.filter(c => c.classification === scoreFilter);
                }
            }
            
            if (responsibleFilter) {
                filteredData = filteredData.filter(c => 
                    c.responsible.toLowerCase().includes(responsibleFilter)
                );
            }
            
            console.log('Dados filtrados:', filteredData.length);
            
            if (filteredData.length > 0) {
                console.log('Primeiro cliente após filtro:', {
                    nome: filteredData[0].nome,
                    score: filteredData[0].health_score,
                    classification: filteredData[0].classification,
                    responsible: filteredData[0].responsible
                });
            }
            
            const tableHTML = `
                <div class="clients-list">
                    ${filteredData.map(client => {
                        console.log(`Renderizando cliente: ${client.nome} - Score: ${client.health_score} - Class: ${client.classification}`);
                        
                        return `
                        <div class="client-item">
                            <div class="client-info">
                                <div class="client-avatar">
                                    ${client.nome.charAt(0).toUpperCase()}
                                </div>
                                <div class="client-details">
                                    <div class="client-name">${client.nome}</div>
                                    <div class="client-meta">
                                        <span>📦 ${client.pedidos_mes} pedidos/mês</span>
                                        <span>💰 ${client.valor_transacionado.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                        <span>📊 ${(client.economia_alcancada * 100).toFixed(1)}% economia</span>
                                        <span>📈 ${client.fornecedores_nao_responderam.toFixed(1)}% não responderam</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="client-badges">
                                <div class="score-circle" style="
                                    background: ${getScoreColor(client.classification)} !important;
                                ">
                                    <div class="score-number">${client.health_score}</div>
                                    <div class="score-label">SCORE</div>
                                </div>
                                
                                ${(client.red_flags && client.red_flags.length > 0) ? `
                                    <div class="red-flags-icons">
                                        <div class="flag-icon" title="${client.red_flags.join(', ')}">${client.red_flags.length}</div>
                                    </div>
                                ` : ''}
                                
                                <div class="responsible-badge">${client.responsible}</div>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            `;
            
            document.getElementById('tableContainer').innerHTML = tableHTML;
        }
        
        // Função para pegar cor do score
        function getScoreColor(classification) {
            switch(classification) {
                case 'verde': return 'linear-gradient(135deg, #10B981, #059669)';
            case 'azul': return 'linear-gradient(135deg, #3B82F6, #2563EB)';
                case 'laranja': return 'linear-gradient(135deg, #F97316, #EA580C)';
                case 'vermelho': return 'linear-gradient(135deg, #EF4444, #DC2626)';
                default: return 'linear-gradient(135deg, #6B7280, #4B5563)';
            }
        }
        
        // Mostrar alertas
        function showAlerts() {
            // Red flags agora são mostrados apenas no modal
            // Esta função mantém a contagem para o gráfico lateral
        }
        
        // Abrir página de Red Flags
        function openRedFlagsPage() {
            if (clientsData.length === 0) {
                alert('⚠️ Carregue dados primeiro para ver os red flags.');
                return;
            }
            
            // Popular dropdown de restaurantes
            const restaurantFilter = document.getElementById('restaurantFilter');
            restaurantFilter.innerHTML = '<option value="">🍽️ Todos os Restaurantes</option>';
            
            clientsData.forEach(client => {
                const option = document.createElement('option');
                option.value = client.nome;
                option.textContent = client.nome;
                restaurantFilter.appendChild(option);
            });
            
            // Carregar todos os red flags
            filterRedFlags();
            
            // Mostrar modal
            document.getElementById('redFlagsModal').style.display = 'block';
        }
        
        // Filtrar Red Flags por restaurante
        function filterRedFlags() {
            const selectedRestaurant = document.getElementById('restaurantFilter').value;
            let filteredClients = clientsData;

            if (selectedRestaurant) {
                filteredClients = clientsData.filter(client => client.nome === selectedRestaurant);
            }

            // Filtrar apenas clientes com red flags E pedidos_mes > 0
            const clientsWithFlags = filteredClients.filter(client =>
                client.red_flags.length > 0 && client.pedidos_mes > 0
            );

            displayRedFlags(clientsWithFlags);
            updateRedFlagsSummary(clientsWithFlags);
        }
        
        // Exibir Red Flags
        function displayRedFlags(clientsWithFlags) {
            const container = document.getElementById('redFlagsContainer');
            
            if (clientsWithFlags.length === 0) {
                container.innerHTML = '<div class="no-data">✅ Nenhum red flag encontrado!</div>';
                return;
            }
            
            const flagsHTML = clientsWithFlags.map(client => `
                <div style="margin-bottom: 20px; padding: 24px; border-radius: 16px; 
                     background: linear-gradient(135deg, ${client.classification === 'vermelho' ? '#7F1D1D, #991B1B' : '#92400E, #B45309'}); 
                     border: 1px solid ${client.classification === 'vermelho' ? '#B91C1C' : '#D97706'}; color: white;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h4 style="margin: 0; color: white; font-size: 1.2em;">
                            🍽️ ${client.nome}
                        </h4>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 600;">
                                Score: ${client.health_score}
                            </span>
                            <span style="font-size: 0.9em; opacity: 0.9;">
                                Responsável: <strong>${client.responsible}</strong>
                            </span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <strong style="color: white; font-size: 1.1em;">🚨 Red Flags (${client.red_flags.length}):</strong>
                        <ul style="margin: 10px 0 0 20px; color: rgba(255,255,255,0.9);">
                            ${client.red_flags.map(flag => `<li style="margin-bottom: 6px;">${flag}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; 
                         font-size: 0.9em; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <div><strong>Pedidos/Mês:</strong> ${client.pedidos_mes}</div>
                        <div><strong>Economia:</strong> ${(client.economia_alcancada * 100).toFixed(1)}%</div>
                        <div><strong>Fornec. Não Resp.:</strong> ${client.fornecedores_nao_responderam.toFixed(1)}%</div>
                        <div><strong>Último Pedido:</strong> ${client.ultimo_pedido ? client.ultimo_pedido.toLocaleDateString('pt-BR') : 'N/A'}</div>
                    </div>
                </div>
            `).join('');
            
            container.innerHTML = flagsHTML;
        }
        
        // Atualizar resumo de Red Flags
        function updateRedFlagsSummary(clientsWithFlags) {
            const summary = document.getElementById('summaryContent');
            
            if (clientsWithFlags.length === 0) {
                summary.innerHTML = '<div style="margin-top: 12px; color: white;">✅ Nenhum red flag ativo no momento!</div>';
                return;
            }
            
            // Contar tipos de red flags
            const flagCounts = {};
            let totalFlags = 0;
            let criticalClients = 0;
            
            clientsWithFlags.forEach(client => {
                if (client.classification === 'vermelho') criticalClients++;
                
                client.red_flags.forEach(flag => {
                    totalFlags++;
                    const flagType = flag.includes('pedidos') ? 'Sem pedidos' :
                                   flag.includes('Fornecedores') ? 'Baixa resposta fornecedores' :
                                   flag.includes('Economia') ? 'Economia baixa' : 'Outros';
                    
                    flagCounts[flagType] = (flagCounts[flagType] || 0) + 1;
                });
            });
            
            const summaryHTML = `
                <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div><strong>Total de Restaurantes:</strong> ${clientsWithFlags.length}</div>
                    <div><strong>Total de Red Flags:</strong> ${totalFlags}</div>
                    <div><strong>Clientes Críticos:</strong> ${criticalClients}</div>
                    <div><strong>Precisam Gabriel:</strong> ${clientsWithFlags.filter(c => c.responsible === 'Gabriel').length}</div>
                    <div><strong>Precisam Jessica:</strong> ${clientsWithFlags.filter(c => c.responsible === 'Jessica').length}</div>
                </div>
                
                <div style="margin-top: 20px;">
                    <strong>📋 Breakdown por tipo:</strong>
                    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px;">
                        ${Object.entries(flagCounts).map(([type, count]) => 
                            `<span style="background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 20px; font-size: 0.9em; border: 1px solid rgba(255,255,255,0.2);">
                                ${type}: ${count}
                            </span>`
                        ).join('')}
                    </div>
                </div>
            `;
            
            summary.innerHTML = summaryHTML;
        }
        
        // Fechar modal de Red Flags
        function closeRedFlagsModal() {
            document.getElementById('redFlagsModal').style.display = 'none';
        }
        
        
        // Atualizar gráficos
        function updateCharts() {
            updateScoreChart();
            updateAlertsChart();
        }
        
        // Gráfico de distribuição de scores
        function updateScoreChart() {
            const stats = {
                verde: clientsData.filter(c => c.classification === 'verde').length,
                azul: clientsData.filter(c => c.classification === 'azul').length,
                laranja: clientsData.filter(c => c.classification === 'laranja').length,
                vermelho: clientsData.filter(c => c.classification === 'vermelho').length
            };

            const total = clientsData.length;

            if (total === 0) {
                document.getElementById('scoreChart').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
                return;
            }

            // Array para renderizar cada barra
            const scoreTypes = [
                { label: 'Verde (≥85)', key: 'verde', color: 'linear-gradient(90deg, #10B981, #059669)' },
                { label: 'Azul (70-84)', key: 'azul', color: 'linear-gradient(90deg, #3B82F6, #2563EB)' },
                { label: 'Laranja (50-69)', key: 'laranja', color: 'linear-gradient(90deg, #F97316, #EA580C)' },
                { label: 'Vermelho (<50)', key: 'vermelho', color: 'linear-gradient(90deg, #EF4444, #DC2626)' }
            ];

            const chartHTML = `
                <div style="display: flex; flex-direction: column; gap: 18px;">
                    ${scoreTypes.map(type => {
                        const count = stats[type.key];
                        const percent = total > 0 ? (count / total) * 100 : 0;
                        return `
                            <div style="margin-bottom: 2px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <span style="font-weight: 600; color: #F1F5F9;">${type.label}</span>
                                    <span style="font-weight: 700; color: #F1F5F9;">${count}</span>
                                </div>
                                <div style="width: 100%; height: 14px; background: #0F172A; border-radius: 7px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                                    <div style="height: 100%; width: ${percent}%; background: ${type.color}; border-radius: 7px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="margin-top: 18px; text-align: right; color: #94A3B8; font-size: 0.95em;">Total: ${total} clientes</div>
            `;

            document.getElementById('scoreChart').innerHTML = chartHTML;
        }
        
        // Gráfico de alertas
        function updateAlertsChart() {
            const alertCounts = {
                'sem-pedidos': { count: 0, label: 'Sem pedidos', clients: [] },
                'taxa-resposta': { count: 0, label: 'Taxa resposta baixa', clients: [] },
                'economia-baixa': { count: 0, label: 'Economia baixa', clients: [] }
            };

            clientsData.forEach(client => {
                client.red_flags.forEach(flag => {
                    // Só conta clientes com pelo menos 1 pedido
                    if (flag.includes('pedidos') && client.pedidos_mes > 0) {
                        alertCounts['sem-pedidos'].count++;
                        alertCounts['sem-pedidos'].clients.push(client);
                    }
                    if ((flag.includes('Fornecedores') || flag.includes('resposta')) && client.pedidos_mes > 0) {
                        alertCounts['taxa-resposta'].count++;
                        alertCounts['taxa-resposta'].clients.push(client);
                    }
                    // Só considera economia baixa se o restaurante tem pelo menos 1 pedido
                    if (flag.includes('Economia') && client.pedidos_mes > 0) {
                        alertCounts['economia-baixa'].count++;
                        alertCounts['economia-baixa'].clients.push(client);
                    }
                });
            });

            const totalAlerts = Object.values(alertCounts).reduce((sum, alert) => sum + alert.count, 0);

            if (totalAlerts === 0) {
                document.getElementById('alertsChart').innerHTML = '<div class="no-data">✅ Nenhum alerta ativo</div>';
                return;
            }
            
            const chartHTML = Object.entries(alertCounts)
                .filter(([_, alert]) => alert.count > 0)
                .map(([key, alert]) => `
                    <div style="margin-bottom: 12px; padding: 16px; background: linear-gradient(135deg, #F59E0B, #D97706); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; border: 1px solid #F59E0B;" 
                         onclick="openAlertDetails('${key}', '${alert.label}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.95em; color: white; font-weight: 600;">${alert.label}</span>
                            <span style="font-weight: 700; color: white; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 12px;">${alert.count}</span>
                        </div>
                        <div style="font-size: 0.8em; color: rgba(255,255,255,0.9); margin-top: 6px;">Clique para ver detalhes</div>
                    </div>
                `).join('');
            
            document.getElementById('alertsChart').innerHTML = chartHTML;
        }
        
        // Abrir detalhes de um tipo específico de alerta
        function openAlertDetails(alertType, alertLabel) {
            const alertCounts = {
                'sem-pedidos': { clients: [] },
                'taxa-resposta': { clients: [] },
                'economia-baixa': { clients: [] }
            };
            
            clientsData.forEach(client => {
                client.red_flags.forEach(flag => {
                    if (alertType === 'sem-pedidos' && flag.includes('pedidos')) {
                        alertCounts['sem-pedidos'].clients.push(client);
                    }
                    if (alertType === 'taxa-resposta' && (flag.includes('Fornecedores') || flag.includes('resposta'))) {
                        alertCounts['taxa-resposta'].clients.push(client);
                    }
                    if (alertType === 'economia-baixa' && flag.includes('Economia')) {
                        alertCounts['economia-baixa'].clients.push(client);
                    }
                });
            });
            
            const clients = alertCounts[alertType].clients;
            
            // Abrir modal específico para este tipo de alerta
            document.getElementById('alertDetailsModal').style.display = 'block';
            document.getElementById('alertDetailsTitle').textContent = `🚨 ${alertLabel} (${clients.length})`;
            
            const detailsHTML = clients.map(client => `
                <div style="margin-bottom: 20px; padding: 20px; border-radius: 16px; background: linear-gradient(135deg, #1E293B, #334155); border: 1px solid #475569;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <strong style="color: #F1F5F9; font-size: 1.1em;">${client.nome}</strong>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <span style="background: ${getScoreColor(client.classification)}; padding: 6px 12px; border-radius: 20px; color: white; font-size: 0.85em; font-weight: 600;">Score: ${client.health_score}</span>
                            <span style="font-size: 0.85em; color: #94A3B8;">Resp: ${client.responsible}</span>
                        </div>
                    </div>
                    <div style="font-size: 0.9em; color: #94A3B8; margin-bottom: 16px;">
                        📦 ${client.pedidos_mes} pedidos | 💰 ${client.valor_transacionado.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} | 
                        📊 ${(client.economia_alcancada * 100).toFixed(1)}% economia
                    </div>
                </div>
            `).join('');
            
            document.getElementById('alertDetailsContent').innerHTML = detailsHTML;
        }
        
        // Fechar modal de detalhes de alertas
        function closeAlertDetailsModal() {
            document.getElementById('alertDetailsModal').style.display = 'none';
        }
        
        // Gerar relatório semanal
        function generateWeeklyReport() {
            if (clientsData.length === 0) {
                alert('Carregue dados primeiro para gerar o relatório.');
                return;
            }
            
            // Salvar dados atuais no histórico
            const weeklySnapshot = {
                date: new Date(),
                clients: JSON.parse(JSON.stringify(clientsData)),
                summary: {
                    total_clients: clientsData.length,
                    verde: clientsData.filter(c => c.classification === 'verde').length,
                    azul: clientsData.filter(c => c.classification === 'azul').length,
                    laranja: clientsData.filter(c => c.classification === 'laranja').length,
                    vermelho: clientsData.filter(c => c.classification === 'vermelho').length,
                    total_alerts: clientsData.reduce((sum, c) => sum + c.red_flags.length, 0),
                    avg_score: clientsData.reduce((sum, c) => sum + c.health_score, 0) / clientsData.length
                }
            };
            
            historicalData.push(weeklySnapshot);
            
            // Gerar e baixar relatório CSV
            const reportData = clientsData.map(client => ({
                'Restaurante': client.nome,
                'Health Score': client.health_score,
                'Classificação': client.classification.toUpperCase(),
                'Responsável': client.responsible,
                'Pedidos/Mês': client.pedidos_mes,
                'Valor Transacionado': client.valor_transacionado,
                'Economia Alcançada': (client.economia_alcancada * 100).toFixed(2) + '%',
                'Fornecedores Não Responderam': client.fornecedores_nao_responderam.toFixed(1) + '%',
                'Quotações': client.quotacoes,
                'Erros de Cotação': client.erros_cotacao,
                'Último Pedido': client.ultimo_pedido ? client.ultimo_pedido.toLocaleDateString('pt-BR') : 'N/A',
                'Último Acesso': client.ultimo_acesso ? client.ultimo_acesso.toLocaleDateString('pt-BR') : 'N/A',
                'Red Flags': client.red_flags.join('; '),
                'Contatado': client.contacted ? 'Sim' : 'Não',
                'Follow-up Agendado': client.followup_scheduled ? client.followup_scheduled.date.toLocaleString('pt-BR') : 'Não',
                'Data Relatório': new Date().toLocaleDateString('pt-BR')
            }));
            
            downloadCSV(reportData, `Health_Score_Report_${new Date().toISOString().split('T')[0]}.csv`);
            
            alert(`Relatório semanal gerado! Total de restaurantes: ${clientsData.length}`);
        }
        
        // Download CSV
        function downloadCSV(data, filename) {
            const csv = convertToCSV(data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        
        // Converter para CSV
        function convertToCSV(data) {
            if (!data || !data.length) return '';
            
            const keys = Object.keys(data[0]);
            const csv = [
                keys.join(','),
                ...data.map(row => keys.map(key => {
                    const value = row[key];
                    return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
                }).join(','))
            ].join('\n');
            
            return csv;
        }
        
        // Event listeners
        document.getElementById('searchBox').addEventListener('input', updateTable);
        document.getElementById('scoreFilter').addEventListener('change', updateTable);
        document.getElementById('responsibleFilter').addEventListener('change', updateTable);
        
        // Fechar modal clicando fora
        window.onclick = function(event) {
            const scheduleModal = document.getElementById('scheduleModal');
            const redFlagsModal = document.getElementById('redFlagsModal');
            const alertDetailsModal = document.getElementById('alertDetailsModal');
            
            if (event.target === scheduleModal) {
                closeModal();
            }
            if (event.target === redFlagsModal) {
                closeRedFlagsModal();
            }
            if (event.target === alertDetailsModal) {
                closeAlertDetailsModal();
            }
        }
        
        // Exemplo de dados para teste (remover em produção)
        function loadSampleData() {
            const sampleData = [
                {
                    Id: 1,
                    Restaurante: 'Restaurante Bom Sabor',
                    Usuários: 3,
                    Pedidos: 5,
                    'Transacionado/Comprado (R$)': 45000,
                    'Fornecedores não responderam (%)': 20,
                    Quotações: 12,
                    'Economia (%)': 6.5,
                    'Performance (%)': 85,
                    'Erros de Cotação': 1,
                    'Link Ult. Pedido': 'https://kompra.app/pedido/123',
                    'Status Ult. Pedido': 'Finalizado',
                    'Último pedido': '2024-07-20',
                    'Último acesso': '2024-07-22',
                    'Última alteração de estoque': '2024-07-21',
                    'Resposta do cliente': 'Sempre',
                    'Participação em treinamentos': 'Sim',
                    'Satisfação declarada': 'Satisfeito',
                    'Upsell ou indicação': 'Sim'
                },
                {
                    Id: 2,
                    Restaurante: 'Pizzaria Tech Solutions',
                    Usuários: 1,
                    Pedidos: 1,
                    'Transacionado/Comprado (R$)': 8000,
                    'Fornecedores não responderam (%)': 45,
                    Quotações: 3,
                    'Economia (%)': 0.8,
                    'Performance (%)': 60,
                    'Erros de Cotação': 2,
                    'Link Ult. Pedido': 'https://kompra.app/pedido/124',
                    'Status Ult. Pedido': 'Em andamento',
                    'Último pedido': '2024-07-01',
                    'Último acesso': '2024-07-15',
                    'Última alteração de estoque': null,
                    'Resposta do cliente': 'Às vezes',
                    'Participação em treinamentos': 'Não',
                    'Satisfação declarada': 'Neutro',
                    'Upsell ou indicação': 'Não'
                }
            ];
            
            processExcelData(sampleData);
        }
