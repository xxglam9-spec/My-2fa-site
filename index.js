const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// --- YOUR CREDENTIALS ---
const BOT_TOKEN = '8347968051:AAEThb_Nmqy-bhdsZwmEnsBSQgXVc-fGYbs';
const MY_CHAT_ID = '7554731151'; 

const bot = new Telegraf(BOT_TOKEN);
const activeAuths = {}; // Temporary memory to store login sessions

app.use(express.static('public'));

// STEP 1: Web Browser starts the login
io.on('connection', (socket) => {
    socket.on('request_login', (email) => {
        const correctNum = Math.floor(Math.random() * 90 + 10);
        const decoys = [Math.floor(Math.random() * 90 + 10), Math.floor(Math.random() * 90 + 10)];
        
        // Store session: Key is email, value is the secret number and the socket connection
        activeAuths[email] = { number: correctNum, socketId: socket.id };

        // Shuffle buttons so the correct one isn't always first
        const buttons = [correctNum, ...decoys].sort(() => Math.random() - 0.5);

        // STEP 2: Server sends the "Push" to Telegram
        bot.telegram.sendMessage(MY_CHAT_ID, `🚨 Login Attempt: ${email}\nTap the matching number on your screen:`, 
            Markup.inlineKeyboard(
                buttons.map(num => Markup.button.callback(num.toString(), `auth_${email}_${num}`))
            )
        );

        // Tell the browser which number to show
        socket.emit('show_number', correctNum);
        console.log(`[SERVER] Sent number ${correctNum} to Telegram for ${email}`);
    });
});

// STEP 3: Handle the button tap on Telegram
bot.action(/auth_(.+)_(.+)/, (ctx) => {
    const email = ctx.match[1];
    const tappedNumber = parseInt(ctx.match[2]);
    const session = activeAuths[email];

    if (session && session.number === tappedNumber) {
        // SUCCESS: Tell the browser to log in!
        io.to(session.socketId).emit('login_success');
        
        ctx.editMessageText(`✅ Verified! You logged in as ${email}`);
        delete activeAuths[email];
    } else {
        ctx.answerCbQuery("❌ Wrong number! Try again.");
    }
});

bot.launch();
http.listen(3000, () => console.log('🚀 2FA System Live at http://localhost:3000'));