const { Client, LocalAuth } = require('./index');
const axios = require('axios');
const cron = require('node-cron');


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        args: ['--no-sandbox'],
        headless: false,
    }
});

client.initialize();

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    console.log('READY');
    const debugWWebVersion = await client.getWWebVersion();
    console.log(`WWebVersion = ${debugWWebVersion}`);
    const cobrancas = await carregarCobrancas();
    await enviarMensagens(cobrancas);
});

const testClientes = [
    // {
    //     telefone: "556284514042", // Substitua por um número válido
    //     data_vencimento: "2025-01-15",
    //     nome: "Cliente Teste 1",
    //     link: "https://toptelecomunicacaogo.sgp.net.br/public/cobranca/38507-0JQ7BMLUFI/",
    //     valor_total: 150.75
    // },
    {
        telefone: "556281115048", // Substitua por um número válido
        data_vencimento: "10/02/2025",
        nome: "CARLOS AUGUSTO PROENCE DA SILVA",
        link: "https://toptelecomunicacaogo.sgp.net.br/boleto/33890-DRX1PQ9LNZ/",
        pix: "00020101021226950014br.gov.bcb.pix2573pix.sicoob.com.br/qr/payload/v2/cobv/6ecc6df0-da8e-4945-a9a3-0d05a02704155204000053039865802BR5925PORTAL TELECOM NC LIMITAD6011Nova Crixas62070503***630493E3",
        valor_total: "89,90"
    }
];

const isTestMode = true;

async function carregarCobrancas() {
    if (isTestMode) {
        console.log("Modo Teste ativado - utilizando dados de teste.");
        return testClientes;
    }
    try {
        const response = await axios.get('http://localhost:8000/cobrancas/vencidas');
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error('Erro ao buscar cobranças:', error);
        return [];
    }
}


async function enviarMensagens(clientes) {
    for (const cliente of clientes) {
        try {
            const telefoneFormatado = cliente.telefone.replace(/[^\d+]/g, '');
            console.log(`Verificando: ${telefoneFormatado}`);

            // Validação 1: Verifica se o número está registrado
            const isRegistered = await client.isRegisteredUser(telefoneFormatado);
            const teste = await client.isRegisteredUser("5562984514042");
            console.log(teste)
            if (!isRegistered) {
                console.error(`Número não registrado: ${telefoneFormatado}`);
                continue;
            }

            // Validação 2: Formata o chatId
            const chatId = `${telefoneFormatado}@c.us`;

            const number = await client.getNumberId(chatId)
            console.log(number);

            // Mensagem
            const mensagem = isTestMode
                ? `TESTE: Olá ${cliente.nome}, sua fatura de R$${cliente.valor_total} venceu em ${cliente.data_vencimento}`
                : `Olá ${cliente.nome}, sua fatura de R$${cliente.valor_total} venceu em ${cliente.data_vencimento}.`;

            // Envio
            await client.sendMessage(chatId, mensagem);
            await delay(5000)
            await client.sendMessage(chatId, 'O link do boleto para pagamento é.');
            await client.sendMessage(chatId, cliente.link);
            await delay(5000)
            await client.sendMessage(chatId, "Para pagamento pelo pix copie e cole o seguinte código no aplicativo do seu banco:")
            await client.sendMessage(chatId, cliente.pix)

            console.log(`✅ Mensagem enviada para ${cliente.nome}`);

            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error(`❌ Erro ao enviar para ${cliente.nome}:`, error);
        }
    }
}

// Agendar para 11:15 da manhã todos os dias
cron.schedule('20 11 * * *', async () => {
    const cobrancas = await carregarCobrancas();
    await enviarMensagens(cobrancas);
}, {
    timezone: 'America/Sao_Paulo'
});