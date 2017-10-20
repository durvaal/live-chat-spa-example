"use strict";
// Opcional. Você verá este nome, por exemplo. comando 'ps' ou 'top'
process.title = 'node-chat';
// Porto onde iremos executar o servidor do websocket
var webSocketsServerPort = 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
// Global variables
var history = [];
// list of currently connected clients (users)
var clients = [];
// Armazena os nomes dos contatos
var contacts = [];
// Array with some colors
var colors = [];
// Verifica se a cor já está atribuida a outro usuário
function selectUserColor() {
    var sort_color = '#' + Math.floor(Math.random() * 16777215).toString(16);
    if (colors.indexOf(sort_color) !== -1) {
        return selectUserColor();
    } else {
        colors.push(sort_color)
        return sort_color;
    }
}
// Adiciona o contato de sua respectiva lista
function addContact(userName, userColor) {
    var exists = false;
    for (var i = 0; i < contacts.length; i++) {
        if (contacts[i].name === userName && contacts[i].color === userColor) {
            exists = true;
        }
    }
    if (!exists) {
        contacts.push({
            name: userName,
            color: userColor
        });
    }
}
// Remove o contato de sua respectiva lista
function removeContact(userName, userColor) {
    for (var i = 0; i < contacts.length; i++) {
        if (contacts[i].name === userName && contacts[i].color === userColor) {
            contacts.splice(i, 1);
        }
    }
}
// Remove o contato de sua respectiva lista
function getContatNameByColor(userColor) {
    for (var i = 0; i < contacts.length; i++) {
        if (contacts[i].color === userColor) {
            return contacts[i].name;
        }
    }
}
// Função onde iremos executar o servidor do websocket
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Não é importante para nós. Estamos escrevendo o servidor WebSocket, não o servidor HTTP
    console.log((new Date()) + ' HTTP server. URL' + request.url + ' requested.');

    if (request.url === '/status') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        var responseObject = {
            currentClients: clients.length,
            totalHistory: history.length
        };
        response.end(JSON.stringify(responseObject));
    } else {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Desculpe, url desconhecida.');
    }
});
server.listen(process.env.PORT || webSocketsServerPort, function() {
    console.log((new Date()) + " O servidor está ouvindo na porta " + webSocketsServerPort);
});
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // O servidor WebSocket está vinculado a um servidor HTTP. 
    // O pedido do WebSocket é apenas uma solicitação HTTP aprimorada.
    // Para mais informações: http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});
// Esta função de retorno de chamada é chamada sempre que alguém
// tenta se conectar ao servidor WebSocket
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Conexão de origem ' + request.origin + '.');
    // aceita conexão - você deve verificar 'request.origin' para
    // certifique-se de que o cliente esteja se conectando do seu site
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin);
    // precisamos saber o índice do cliente para removê-los no evento 'fechar'
    var index = clients.push(connection) - 1;
    var userName = false;
    var userColor = false;
    console.log((new Date()) + ' Conexão aceita.');
    // enviar o histórico de bate-papo
    if (history.length > 0) {
        connection.sendUTF(JSON.stringify({ type: 'history', data: history }));
    }
    // enviar o histórico de contatos ativos
    if (contacts.length > 0) {
        connection.sendUTF(JSON.stringify({ type: 'contacts', data: contacts }));
    }
    // o usuário enviou alguma mensagem
    connection.on('message', function(request) {
        var res = JSON.parse(request.utf8Data);
        if (res.type === 'sigin') { // login
            // A primeira mensagem enviada pelos usuários é o nome deles
            // lembre-se do nome do usuário
            userName = res.data;
            // obter cor aleatória e enviá-lo de volta ao usuário   
            userColor = selectUserColor();
            connection.sendUTF(JSON.stringify({ type: 'color', data: { author: userName, color: userColor } }));
            console.log((new Date()) + ' O usuário é: ' + userName + ' com a cor ' + userColor + '.');
            // Adiciona o contato a lista de contatos
            addContact(userName, userColor);
            // enviar o histórico de contatos ativos
            for (var i = 0; i < clients.length; i++) {
                clients[i].sendUTF(JSON.stringify({ type: 'contacts', data: contacts }));
            }
        } else { // registrar e transmitir a mensagem
            if (res.type === 'broadcast') {
                console.log((new Date()) + ' Mensagem recebida de ' + userName + ': ' + res.data.text)
                    // Adiciona o contato a lista de contatos
                addContact(userName, userColor);
                // queremos manter o histórico de todas as mensagens enviadas
                var obj = {
                    time: (new Date()).getTime(),
                    text: res.data.text,
                    author: userName,
                    color: userColor
                };
                history.push(obj);
                for (var i = 0; i < clients.length; i++) {
                    clients[i].sendUTF(JSON.stringify({ type: 'message', data: obj }));
                    // enviar o histórico de contatos ativos
                    clients[i].sendUTF(JSON.stringify({ type: 'contacts', data: contacts }));
                }
            } else {
                connection.sendUTF(JSON.stringify({ type: 'error', data: "Formato de mensagem inválida." }));
            }
        }
        console.log("Add " + clients.length)
    });
    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Ponto " + connection.remoteAddress + " desconectado.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // Remove o registro da cor do array de cores já atribuidas
            colors.splice(colors.indexOf(userColor), 1);
            // Remove o contato
            removeContact(userName, userColor);
            // enviar o histórico de contatos ativos
            console.log("Remove " + clients.length)
            for (var i = 0; i < clients.length; i++) {
                clients[i].sendUTF(JSON.stringify({ type: 'contacts', data: contacts }));
            }
        }
    });
});