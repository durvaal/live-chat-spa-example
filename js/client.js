$(function() {
    "use strict";
    // para um melhor desempenho
    var content = $('#content-message');
    var input = $('#input');
    var status = $('#status');
    var contact = $('#contacts');
    // minha cor atribuída pelo servidor
    var myColor = false;
    // meu nome rnviado para o servidor
    var myName = false;
    // Se o usuário estiver executando mozilla, então use o WebSocket embutido
    window.WebSocket = window.WebSocket || window.MozWebSocket;
    // se o navegador não suportar o WebSocket, basta mostrar alguma notificação e saída
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Desculpe, mas o seu navegador não suporta o WebSocket.' }));
        input.hide();
        $('span').hide();
        return;
    }
    // open connection
    var connection = new WebSocket('ws://127.0.0.1:1337');
    connection.onopen = function() {
        // primeiro queremos que os usuários digitem seus nomes
        input.removeAttr('disabled');
        status.text('Escolha seu nome:');
    };
    connection.onerror = function(error) {
        // apenas houve problemas com a conexão ...
        content.html($('<p>', {
            text: 'Desculpe, mas há algum problema com a sua conexão ou o servidor caiu.'
        }));
    };
    // parte mais importante - mensagens recebidas
    connection.onmessage = function(message) {
        // tente analisar a mensagem JSON. Porque sabemos que o servidor
        // sempre retorna JSON isso deve funcionar sem qualquer problema, mas
        // devemos ter certeza de que a massagem não está fragmentada ou
        // de outra forma danificado.
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('JSON inválido: ', message.data);
            return;
        }
        // NOTA: se você não tem certeza sobre a estrutura JSON
        // verifique o código-fonte do servidor acima
        // primeira resposta do servidor com a cor do usuário
        if (json.type === 'color') {
            myColor = json.data;
            status.text(myName + ': ').css('color', myColor);
            input.removeAttr('disabled').focus();
            // A partir de agora, o usuário pode começar a enviar mensagens
        } else if (json.type === 'history') { // histórico de mensagens enviadas
            // insira todas as mensagens na janela de bate-papo
            for (var i = 0; i < json.data.length; i++) {
                addMessage(json.data[i].author, json.data[i].text, json.data[i].color, new Date(json.data[i].time));
            }
        } else if (json.type === 'message') { // é uma única mensagem
            // deixe o usuário escrever outra mensagem
            input.removeAttr('disabled');
            addMessage(json.data.author, json.data.text, json.data.color, new Date(json.data.time));
        } else if (json.type === 'contacts') { // é uma lista de contatos
            addContacts(json.data);
        } else {
            console.log('Hmm ..., eu nunca vi um JSON assim:', json);
        }
    };
    /**
     * Enviar mensagem quando o usuário pressiona a tecla Enter
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // envie a mensagem como um texto comum
            connection.send(msg);
            $(this).val('');
            // desativar o campo de entrada para que o usuário aguarde até o servidor
                         // envia resposta de volta
            input.attr('disabled', 'disabled');
            // sabemos que a primeira mensagem enviada de um usuário é o nome deles
            if (myName === false) {
                myName = msg;
            }
        }
    });
    /**
     * Este método é opcional. Se o servidor não puder
     * responda em 3 segundos e mostre alguma mensagem de erro
     * para notificar o usuário de que algo está errado.
     */
    setInterval(function() {
        if (connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('Não é possível se comunicar com o servidor WebSocket.');
        }
    }, 3000);
    /**
     * Adicionar mensagem à janela de bate-papo
     */
    function addMessage(author, message, color, dt) {
        content.append('<p><span style="color:' + color + '">' +
            author + '</span> @ ' +
            (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':' + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes()) +
            ': ' + message + '</p>');
    }

    function addContacts(contacts) {
        contact.find("ul li").remove();
        for (var i = 0; i < contacts.length; i++) {
            contact.find("ul").append("<li style='color: " + contacts[i].color + "'>" + contacts[i].name + "</li>");
        }
        if (!contacts.length) {
            contact.find("ul").append("<li>Nenhum contato ativo</li>");
        }
    }
});