const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// --- YOUR CREDENTIALS ---
const BOT_TOKEN = '8347968051:AAEThb_Nmqy-bhdsZwmEnsBSQgXVc-fGYbs';
const MY_CHAT_ID = '7554731151'; 

const bot = new Telegraf(BOT_TOKEN);
const activeAuths = {}; 

// --- STEP 1: THE WEBSITE (The "Face" of your app) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Secure 2FA Login</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="/socket.io/socket.io.js"></script>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
                .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; width: 300px; }
                input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #0088cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                #number-display { font-size: 60px; font-weight: bold; margin: 20px 0; color: #1c1e21; display: none; }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <h2>Login</h2>
                <input type="email" id="email" placeholder="Enter Email">
                <button onclick="requestLogin()">Continue</button>
            </div>

            <script>
                const socket = io();
                function requestLogin() {
                    const email = document.getElementById('email').value;
                    if(!email) return alert("Enter email!");
                    socket.emit('request_login', email);
                }

                socket.on('show_number', (num) => {
                    document.getElementById('box').innerHTML = \`
                        <h2>Match the Number</h2>
                        <p>Tap this number on your Telegram app:</p>
                        <div id="number-display" style="display:block;">\${num}</div>
                        <p style="font-size:12px; color:gray;">Waiting for you to tap...</p>
                    \`;
                });

                socket.on('login_success', () => {
                    document.getElementById('box').innerHTML = "<h1>✅ Access Granted!</h1><p>You are now logged in.</p>";
                });
            </script>
        </body>
        </html>
    `);
});

// --- STEP 2: THE LOGIC (The "Brain") ---
io.on('connection', (socket) => {
    socket.on('request_login', (email) => {
        const correctNum = Math.floor(Math.random() * 90 + 10);
        const decoys = [Math.floor(Math.random() * 90 + 10), Math.floor(Math.random() * 90 + 10)];
        
        activeAuths[email] = { number: correctNum, socketId: socket.id };
        const buttons = [correctNum, ...decoys].sort(() => Math.random() - 0.5);

        bot.telegram.sendMessage(MY_CHAT_ID, `🚨 *Login Attempt:* \`${email}\` \n\nTap the number you see on your screen:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(
                buttons.map(num => Markup.button.callback(num.toString(), `auth_${email}_${num}`))
            )
        });

        socket.emit('show_number', correctNum);
    });
});

bot.action(/auth_(.+)_(.+)/, (ctx) => {
    const email = ctx.match[1];
    const tappedNumber = parseInt(ctx.match[2]);
    const session = activeAuths[email];

    if (session && session.number === tappedNumber) {
        io.to(session.socketId).emit('login_success');
        ctx.editMessageText(`✅ *Verified!*\nLogged in as: ${email}`, { parse_mode: 'Markdown' });
        delete activeAuths[email];
    } else {
        ctx.answerCbQuery("❌ Wrong number! Look at the screen again.");
    }
});

// --- STEP 3: STARTUP ---
// Use process.env.PORT so Render can choose the port automatically
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 Server running on port \${PORT}`);
    bot.launch();
});
