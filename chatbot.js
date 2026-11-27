// =====================================
// IMPORTAÇÕES
// =====================================
const qrcode = require("qrcode-terminal");
const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");
const horarios = require("./horarios");       // isso serve para chamar o horarios.js e tarifas.js

// FUNÇÃO PARA REGISTRAR LOGS
function log(tipo, mensagem, detalhe = "") {
  const horario = new Date().toLocaleString("pt-BR");
  console.log(`[${horario}] [${tipo}] ${mensagem}`, detalhe);
}
// =====================================
// CONFIGURAÇÃO DO CLIENTE
// =====================================
const client = new Client({
  authStrategy: new LocalAuth(),
  authTimeoutMs: 60000,
  puppeteer: {
    headless: false,    // true o chrome abre em segundo plano, Flase ele mnostra
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],
  },
});

// =====================================
// QR CODE
// =====================================
client.on("qr", (qr) => {
  console.log("📲 Escaneie o QR Code abaixo:");
  qrcode.generate(qr, { small: true });
});

// =====================================
// WHATSAPP CONECTADO E DIAGNÓSTICOS
// =====================================

client.on("ready", () => {
  log("READY", "WhatsApp conectado e pronto para receber mensagens!");

  if (client.pupPage) {
    client.pupPage.on("pageerror", (error) => {
      log("ERRO NAVEGADOR", error.message);
    });

    client.pupPage.on("requestfailed", (request) => {
      log(
        "FALHA REQUISIÇÃO",
        request.failure()?.errorText || "Erro desconhecido"
      );
    });
  }
});

client.on("loading_screen", (percent, message) => {
  log("LOADING", `${percent}% - ${message}`);
});

client.on("authenticated", () => {
  log("AUTH", "Autenticação realizada com sucesso!");
});

client.on("auth_failure", (message) => {
  log("ERRO AUTH", "Falha na autenticação", message);
});

client.on("change_state", (state) => {
  log("ESTADO", `Estado do WhatsApp: ${state}`);
});

// =====================================
// DESCONEXÃO
// =====================================

client.on("disconnected", (reason) => {
  log("DESCONECTADO", `WhatsApp desconectado: ${reason}`);
});

client.on("remote_session_saved", () => {
  log("SESSÃO", "Sessão remota salva.");
});



// =====================================
// CONTROLE DE ETAPAS DAS CONVERSAS - controle de estados para evitar confundir os Menus
// =====================================
const estados = new Map();

// =====================================
// FUNÇÃO DE DELAY
// =====================================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// =====================================
// FUNIL DE MENSAGENS (SOMENTE PRIVADO)
// =====================================
client.on("message", async (msg) => {
  console.log("📩 Evento de mensagem recebido!");
  try {
    log("PROCESSAMENTO", "Iniciando análise da mensagem");
    // ❌ IGNORA QUALQUER COISA QUE NÃO SEJA CONVERSA PRIVADA
    if (!msg.from || msg.from.endsWith("@g.us")) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return; // blindagem extra

    const texto = msg.body ? msg.body.trim().toLowerCase() : "";

    const dia = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); //  Serve para remover os acentos da palavra, assim o bot sabe que terça e terca são a mesma coisa.

    // Função de digitação
    const typing = async () => {
      await delay(2000);
      await chat.sendStateTyping();
      await delay(2000);
    };


    // =====================================
    // MENSAGEM INICIAL
    // =====================================
    if (/^(menu|oi|olá|ola|bom dia|boa tarde|boa noite)$/i.test(texto)) {

      await typing();

      const hora = new Date().getHours();
      let saudacao = "Olá";

      if (hora >= 5 && hora < 12) saudacao = "Bom dia";
      else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
      else saudacao = "Boa noite";

      // Define o estado do cliente
      estados.set(msg.from, "menu");

      await client.sendMessage(
        msg.from,
        `${saudacao}! 👋\n\n` +
        `Seja bem-vindo(a) à Rodotur Turismo! 🚌\n\n` +
        `🤖 Você está sendo atendido por um de nossos robôs. Para continuar, digite o número correspondente ao que deseja:\n\n` +
        `1 - Horários Rodoviários 🕛\n` +
        `2 - Tarifas Rodoviárias 💲\n` +
        `3 - Falar com atendente ☎️\n` +
        `4 - Elogios ou Sugestões 😁\n` +
        `5 - LGPD 📜\n` +
        `6 - Reclamações 😡`
      );

      return;
    }



    // VOLTAR AO MENU PRINCIPAL
    // =====================================
    if (texto === "0") {

      await typing();

      estados.set(msg.from, "menu");

      await client.sendMessage(
        msg.from,
        `Menu Principal 🏠\n\n` +
        `1 - Horários Rodoviários 🕛\n` +
        `2 - Tarifas Rodoviárias 💲\n` +
        `3 - Falar com atendente ☎️\n` +
        `4 - Elogios ou Sugestões 😁\n` +
        `5 - LGPD 📜\n` +
        `6 - Reclamações 😡`
      );

      return;
    }

    // =====================================
    // OPÇÃO 1 - HORÁRIOS RODOVIÁRIOS
    // =====================================
    if (estados.get(msg.from) === "menu" && texto === "1") {

      await typing();

      estados.set(msg.from, "escolher_linha");

      await client.sendMessage(
        msg.from,
        `🕛 Horários Rodoviários 🕛\n\n` +
        `Por favor, digite o número da linha na qual deseja ver os horários:\n\n` +
        `1 - Recife x Goiana 🚌\n` +
        `2 - Recife x Ponta de Pedra 🚌\n` +
        `3 - Goiana x Ponta de Pedra 🚌\n` +
        `4 - Goiana x Itaquitinga 🚌\n\n` +
        `0 - Menu Principal ↩️`
      );

      return;
    }


    // =====================================
    // NOVOS HORÁRIOS - RECIFE X GOIANA
    // =====================================
    if (estados.get(msg.from) === "escolher_dia_recife_goiana") {

      // Identifica o dia escolhido pelo passageiro
      let chaveHorario = null;

      if (["1", "segunda", "segunda-feira"].includes(dia)) {
        chaveHorario = "segunda";
      }
      else if (
        ["2", "terca", "terca-feira", "quarta", "quarta-feira", "quinta", "quinta-feira"].includes(dia)
      ) {
        chaveHorario = "terca_quinta";
      }

      // Busca os horários no arquivo horarios.js
      if (chaveHorario) {

        await typing();

        estados.set(msg.from, "escolher_dia_recife_goiana");

        const horario = horarios.recife_goiana[chaveHorario];

        const tabela = horario.partidas
          .map(([goiana, recife]) => `${goiana.padEnd(29)}${recife}`)
          .join("\n");

        await client.sendMessage(
          msg.from,
          `🚌 GOIANA X RECIFE 🚌\n` +
          `📅 ${horario.titulo} 📅\n\n` +
          `Saindo Goiana    Saindo Recife\n\n` +
          `${tabela}\n\n` +
          `📅 Caso queira ver outros dias da semana basta digitar o nome do dia ex: Segunda.\n` +
          `Digite 0 para voltar ao menu principal.`
        );

        return;
      }
    }



    /*
        // =====================================
        // HORÁRIOS - RECIFE X GOIANA - SEGUNDA
        // =====================================
        if (
          estados.get(msg.from) === "escolher_dia_recife_goiana" &&
          ["1", "segunda", "segunda-feira"].includes(dia)
        ) {
    
          await typing();
    
          estados.set(msg.from, "escolher_dia_recife_goiana");
    
          await client.sendMessage(
            msg.from,
            `🚌 GOIANA X RECIFE 🚌\n` +
            `📅 SEGUNDA-FEIRA 📅\n\n` +
            `Saindo Goiana    Saindo Recife\n\n` +
            `04:30                         04:50\n` +
            `05:00                         05:00\n` +
            `05:30                         05:30\n` +
            `05:45                         06:00\n` +
            `06:00                         06:20\n` +
            `06:15                         06:40\n` +
            `06:30                         07:00\n` +
            `06:45                         07:30\n` +
            `07:00                         08:00\n` +
            `07:20                         08:30\n` +
            `07:40                         09:00\n` +
            `08:00                         09:30\n` +
            `08:30                         10:00\n` +
            `09:00                         10:30\n` +
            `09:30                         11:00\n` +
            `10:00                         11:30\n` +
            `10:30                         12:00\n` +
            `11:00                         12:30\n` +
            `11:30                         13:00\n` +
            `12:00                         13:30\n` +
            `13:00                         14:00\n` +
            `14:00                         14:30\n` +
            `14:30                         15:00\n` +
            `15:00                         15:30\n` +
            `15:30                         16:00\n` +
            `16:00                         16:20\n` +
            `16:30                         16:40\n` +
            `17:00                         17:00\n` +
            `18:00                         17:30\n` +
            `-                              18:00\n\n` +
            `📅 Caso queira ver outros dias da semana basta digitar o nome do dia ex: Segunda.\n` +
            `Digite 0 para voltar ao menu principal.`
          );
    
          return;
        }
    
    
    
        // =====================================
        // HORÁRIOS - RECIFE X GOIANA - TERÇA A QUINTA
        // =====================================
        if (
          estados.get(msg.from) === "escolher_dia_recife_goiana" &&
          ["2", "terca", "terca-feira", "quarta", "quarta-feira", "quinta", "quinta-feira"].includes(dia)
        ) {
    
          await typing();
    
          estados.set(msg.from, "escolher_dia_recife_goiana");
    
          await client.sendMessage(
            msg.from,
            `🚌 GOIANA X RECIFE 🚌\n` +
            `📅 TERÇA A QUINTA-FEIRA 📅\n\n` +
            `Saindo Goiana    Saindo Recife\n\n` +
            `04:50                         04:50\n` +
            `05:20                         05:30\n` +
            `05:40                         06:00\n` +
            `06:00                         06:30\n` +
            `06:30                         07:00\n` +
            `07:00                         07:30\n` +
            `07:30                         08:00\n` +
            `08:00                         08:30\n` +
            `08:30                         09:00\n` +
            `09:00                         09:30\n` +
            `09:30                         10:00\n` +
            `10:00                         11:00\n` +
            `11:00                         11:30\n` +
            `11:30                         12:00\n` +
            `12:00                         12:30\n` +
            `12:30                         13:00\n` +
            `13:00                         13:30\n` +
            `13:30                         14:00\n` +
            `14:00                         14:30\n` +
            `14:30                         15:00\n` +
            `15:00                         15:30\n` +
            `15:30                         16:00\n` +
            `16:00                         16:30\n` +
            `16:30                         17:00\n` +
            `17:00                         17:30\n` +
            `18:00                         18:00\n\n` +
            `📅 Caso queira ver outros dias da semana basta digitar o nome do dia ex: Segunda.\n` +
            `Digite 0 para voltar ao menu principal.`
          );
    
          return;
        }
    
    
    
    */




































  } catch (error) {
    log("ERRO PROCESSAMENTO", error.message);
    console.error(error.stack);
  }
});


// =====================================
// INICIALIZA O WHATSAPP
// =====================================
console.log("Iniciando conexão com o WhatsApp...");

client.initialize().catch((error) => {
  console.error("Erro ao inicializar o WhatsApp:", error);
});