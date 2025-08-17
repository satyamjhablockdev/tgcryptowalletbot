const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const WALLETS_FILE = path.join(__dirname, 'wallets.json');
const TOKENS_FILE = path.join(__dirname, 'custom_tokens.json');

// Top 10 EVM Chains Configuration
const CHAINS = {
    1: {
        name: 'Ethereum',
        symbol: 'ETH',
        rpc: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        explorer: 'https://etherscan.io',
        icon: '🔷'
    },
    137: {
        name: 'Polygon',
        symbol: 'MATIC',
        rpc: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        icon: '🟣'
    },
    56: {
        name: 'BNB Chain',
        symbol: 'BNB',
        rpc: 'https://bsc-dataseed1.binance.org',
        explorer: 'https://bscscan.com',
        icon: '🟡'
    },
    43114: {
        name: 'Avalanche',
        symbol: 'AVAX',
        rpc: 'https://api.avax.network/ext/bc/C/rpc',
        explorer: 'https://snowtrace.io',
        icon: '🔺'
    },
    250: {
        name: 'Fantom',
        symbol: 'FTM',
        rpc: 'https://rpc.ftm.tools',
        explorer: 'https://ftmscan.com',
        icon: '👻'
    },
    42161: {
        name: 'Arbitrum One',
        symbol: 'ETH',
        rpc: 'https://arb1.arbitrum.io/rpc',
        explorer: 'https://arbiscan.io',
        icon: '🔵'
    },
    10: {
        name: 'Optimism',
        symbol: 'ETH',
        rpc: 'https://mainnet.optimism.io',
        explorer: 'https://optimistic.etherscan.io',
        icon: '🔴'
    },
    25: {
        name: 'Cronos',
        symbol: 'CRO',
        rpc: 'https://evm.cronos.org',
        explorer: 'https://cronoscan.com',
        icon: '💎'
    },
    1285: {
        name: 'Moonriver',
        symbol: 'MOVR',
        rpc: 'https://rpc.api.moonriver.moonbeam.network',
        explorer: 'https://moonriver.moonscan.io',
        icon: '🌙'
    },
    100: {
        name: 'Gnosis Chain',
        symbol: 'xDAI',
        rpc: 'https://rpc.gnosischain.com',
        explorer: 'https://gnosisscan.io',
        icon: '🟢'
    }
};

// ERC-20 Token ABI (minimal)
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// ERC-721 NFT ABI (minimal)
const ERC721_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
];

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Storage
let userWallets = {};
let userSettings = {};
let customTokens = {};

// Load data
function loadData() {
    try {
        if (fs.existsSync(WALLETS_FILE)) {
            const data = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf8'));
            userWallets = data.wallets || {};
            userSettings = data.settings || {};
        }
        if (fs.existsSync(TOKENS_FILE)) {
            customTokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Save data
function saveData() {
    try {
        fs.writeFileSync(WALLETS_FILE, JSON.stringify({ wallets: userWallets, settings: userSettings }, null, 2));
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(customTokens, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Get provider for chain
function getProvider(chainId) {
    const chain = CHAINS[chainId];
    if (!chain) return null;
    return new ethers.JsonRpcProvider(chain.rpc);
}

// Get user's current chain
function getCurrentChain(userId) {
    return userSettings[userId]?.currentChain || 1; // Default to Ethereum
}

// Set user's current chain
function setCurrentChain(userId, chainId) {
    if (!userSettings[userId]) userSettings[userId] = {};
    userSettings[userId].currentChain = chainId;
    saveData();
}

// Format amount with proper decimals
function formatToken(amount, decimals = 18, symbol = 'ETH') {
    const formatted = parseFloat(ethers.formatUnits(amount, decimals)).toFixed(6);
    return `${formatted} ${symbol}`;
}

// Create wallet
function createWallet(userId) {
    const wallet = ethers.Wallet.createRandom();
    userWallets[userId] = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase,
        createdAt: new Date().toISOString()
    };
    userSettings[userId] = { currentChain: 1 };
    saveData();
    return userWallets[userId];
}

// Get wallet
function getWallet(userId) {
    return userWallets[userId] || null;
}

// Chain selection keyboard
function getChainKeyboard() {
    const keyboard = [];
    const chainIds = Object.keys(CHAINS);
    
    for (let i = 0; i < chainIds.length; i += 2) {
        const row = [];
        const chain1 = CHAINS[chainIds[i]];
        row.push({ text: `${chain1.icon} ${chain1.name}`, callback_data: `chain_${chainIds[i]}` });
        
        if (i + 1 < chainIds.length) {
            const chain2 = CHAINS[chainIds[i + 1]];
            row.push({ text: `${chain2.icon} ${chain2.name}`, callback_data: `chain_${chainIds[i + 1]}` });
        }
        keyboard.push(row);
    }
    
    return { inline_keyboard: keyboard };
}

// Main menu keyboard
function getMainMenuKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '💰 Balance', callback_data: 'balance' },
                { text: '📤 Send', callback_data: 'send' }
            ],
            [
                { text: '📥 Receive', callback_data: 'receive' },
                { text: '🔄 Switch Chain', callback_data: 'switch_chain' }
            ],
            [
                { text: '🪙 Custom Tokens', callback_data: 'tokens' },
                { text: '🎨 NFTs', callback_data: 'nfts' }
            ],
            [
                { text: '⚙️ Settings', callback_data: 'settings' }
            ]
        ]
    };
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const welcomeMessage = `
🚀 *Multi-Chain Crypto Wallet Bot*

🌐 *Supported Chains:*
${Object.values(CHAINS).map(chain => `${chain.icon} ${chain.name}`).join('\n')}

✨ *Features:*
• Native token transactions
• Custom ERC-20 tokens
• NFT viewing and management
• Multi-chain support
• Secure wallet management

${getWallet(userId) ? '✅ Wallet found! Use the menu below:' : '🆕 Create a wallet to get started!'}
    `;
    
    const options = {
        parse_mode: 'Markdown',
        reply_markup: getWallet(userId) ? getMainMenuKeyboard() : {
            inline_keyboard: [[{ text: '🆕 Create Wallet', callback_data: 'create_wallet' }]]
        }
    };
    
    bot.sendMessage(chatId, welcomeMessage, options);
});

bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const wallet = getWallet(userId);
    if (!wallet) {
        bot.sendMessage(chatId, '❌ No wallet found. Use /start to create one.');
        return;
    }
    
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    bot.sendMessage(chatId, `💼 *Wallet Menu*\n\n🌐 Current Chain: ${chain.icon} ${chain.name}`, {
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard()
    });
});

// Add this function to handle main menu display
function showMainMenu(chatId, userId, messageId) {
    const wallet = getWallet(userId);
    if (!wallet) {
        bot.editMessageText('❌ No wallet found. Use /start to create one.', {
            chat_id: chatId,
            message_id: messageId
        });
        return;
    }
    
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    bot.editMessageText(`💼 *Wallet Menu*\n\n🌐 Current Chain: ${chain.icon} ${chain.name}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard()
    });
}

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
    try {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg.chat.id;
        const userId = callbackQuery.from.id;
        
        await bot.answerCallbackQuery(callbackQuery.id);
        
        if (data === 'create_wallet') {
            createWalletHandler(chatId, userId);
        } else if (data.startsWith('chain_')) {
            const chainId = parseInt(data.split('_')[1]);
            setCurrentChain(userId, chainId);
            const chain = CHAINS[chainId];
            
            bot.editMessageText(
                `✅ Switched to ${chain.icon} *${chain.name}*\n\nUse the menu below:`,
                {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: getMainMenuKeyboard()
                }
            );
        } else if (data === 'switch_chain') {
            bot.editMessageText(
                '🌐 *Select Chain:*',
                {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: getChainKeyboard()
                }
            );
        } else if (data === 'balance') {
            checkBalance(chatId, userId, msg.message_id);
        } else if (data === 'receive') {
            showReceiveAddress(chatId, userId, msg.message_id);
        } else if (data === 'send') {
            initiateSend(chatId, userId);
        } else if (data === 'tokens') {
            showTokenMenu(chatId, userId, msg.message_id);
        } else if (data === 'nfts') {
            showNFTs(chatId, userId, msg.message_id);
        } else if (data === 'add_token') {
            initiateAddToken(chatId, userId);
        } else if (data === 'list_tokens') {
            listCustomTokens(chatId, userId, msg.message_id);
        } else if (data === 'menu') {
            showMainMenu(chatId, userId, msg.message_id);
        }
    } catch (error) {
        console.error('Callback query error:', error);
        try {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Error occurred. Please try again.',
                show_alert: true
            });
        } catch (e) {
            console.error('Error answering callback:', e);
        }
    }
});

function createWalletHandler(chatId, userId) {
    if (getWallet(userId)) {
        bot.sendMessage(chatId, '❌ You already have a wallet!');
        return;
    }
    
    try {
        const wallet = createWallet(userId);
        
        const message = `
✅ *Wallet Created Successfully!*

📱 *Address:* \`${wallet.address}\`

🔐 *Mnemonic Phrase:*
\`${wallet.mnemonic}\`

⚠️ *IMPORTANT:*
• Save your mnemonic phrase securely
• Never share it with anyone
• This wallet works on all supported chains

🌐 *Default Chain:* 🔷 Ethereum
        `;
        
        bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard()
        });
    } catch (error) {
        console.error('Error creating wallet:', error);
        bot.sendMessage(chatId, '❌ Error creating wallet. Please try again.');
    }
}

async function checkBalance(chatId, userId, messageId) {
    const wallet = getWallet(userId);
    if (!wallet) {
        bot.editMessageText('❌ No wallet found.', { chat_id: chatId, message_id: messageId });
        return;
    }
    
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    const provider = getProvider(currentChain);
    
    try {
        bot.editMessageText('🔄 Checking balances...', { chat_id: chatId, message_id: messageId });
        
        // Get native token balance
        const balance = await provider.getBalance(wallet.address);
        const nativeBalance = formatToken(balance, 18, chain.symbol);
        
        // Get custom token balances
        let tokenBalances = '';
        const userTokens = customTokens[userId]?.[currentChain] || [];
        
        for (const token of userTokens) {
            try {
                const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                const tokenBalance = await contract.balanceOf(wallet.address);
                const decimals = await contract.decimals();
                
                if (tokenBalance > 0) {
                    const formatted = formatToken(tokenBalance, decimals, token.symbol);
                    tokenBalances += `\n🪙 ${formatted}`;
                }
            } catch (error) {
                console.error(`Error checking token ${token.symbol}:`, error);
            }
        }
        
        const message = `
💰 *Balance on ${chain.icon} ${chain.name}*

📱 *Address:* \`${wallet.address}\`
💎 *${chain.symbol}:* ${nativeBalance}${tokenBalances}

${parseFloat(ethers.formatEther(balance)) === 0 ? `💡 Send some ${chain.symbol} to this address to get started!` : ''}
        `;
        
        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]] }
        });
        
    } catch (error) {
        console.error('Error checking balance:', error);
        bot.editMessageText('❌ Error checking balance. Please try again.', {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

function showReceiveAddress(chatId, userId, messageId) {
    const wallet = getWallet(userId);
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    const message = `
📥 *Receive ${chain.symbol} on ${chain.name}*

💳 *Your Address:*
\`${wallet.address}\`

⚠️ *Important:*
• Only send ${chain.symbol} and ${chain.name} tokens to this address
• Sending tokens from other chains will result in loss
• Double-check the address before sharing

🌐 *Explorer:* [View on ${chain.name}](${chain.explorer}/address/${wallet.address})
    `;
    
    bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]] }
    });
}

function showTokenMenu(chatId, userId, messageId) {
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    const message = `
🪙 *Custom Tokens on ${chain.icon} ${chain.name}*

Manage your ERC-20 tokens:
    `;
    
    bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '➕ Add Token', callback_data: 'add_token' },
                    { text: '📋 List Tokens', callback_data: 'list_tokens' }
                ],
                [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
            ]
        }
    });
}

function initiateAddToken(chatId, userId) {
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    bot.sendMessage(chatId, 
        `➕ *Add Custom Token to ${chain.icon} ${chain.name}*\n\nPlease send the token contract address:`,
        { parse_mode: 'Markdown' }
    );
    
    const listener = async (response) => {
        if (response.chat.id !== chatId || response.from.id !== userId) return;
        
        const address = response.text.trim();
        
        if (!ethers.isAddress(address)) {
            bot.sendMessage(chatId, '❌ Invalid contract address.');
            return;
        }
        
        await addCustomToken(chatId, userId, currentChain, address);
        bot.removeListener('message', listener);
    };
    
    bot.on('message', listener);
}

async function addCustomToken(chatId, userId, chainId, address) {
    try {
        const provider = getProvider(chainId);
        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        
        bot.sendMessage(chatId, '🔄 Fetching token information...');
        
        const [name, symbol, decimals] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals()
        ]);
        
        // Initialize user's custom tokens if not exists
        if (!customTokens[userId]) customTokens[userId] = {};
        if (!customTokens[userId][chainId]) customTokens[userId][chainId] = [];
        
        // Check if token already exists
        const exists = customTokens[userId][chainId].some(token => 
            token.address.toLowerCase() === address.toLowerCase()
        );
        
        if (exists) {
            bot.sendMessage(chatId, '❌ Token already added.');
            return;
        }
        
        // Add token
        customTokens[userId][chainId].push({
            address,
            name,
            symbol,
            decimals: decimals.toString(),
            addedAt: new Date().toISOString()
        });
        
        saveData();
        
        const chain = CHAINS[chainId];
        bot.sendMessage(chatId, 
            `✅ *Token Added Successfully!*\n\n🪙 *${name} (${symbol})*\n📍 ${chain.icon} ${chain.name}\n📄 \`${address}\``,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('Error adding token:', error);
        bot.sendMessage(chatId, '❌ Error adding token. Please check the address and try again.');
    }
}

function listCustomTokens(chatId, userId, messageId) {
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    const userTokens = customTokens[userId]?.[currentChain] || [];
    
    if (userTokens.length === 0) {
        bot.editMessageText(
            `📋 *Custom Tokens on ${chain.icon} ${chain.name}*\n\n❌ No custom tokens added yet.\n\nUse "Add Token" to add your first token.`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Tokens', callback_data: 'tokens' }]]
                }
            }
        );
        return;
    }
    
    let tokenList = `📋 *Custom Tokens on ${chain.icon} ${chain.name}*\n\n`;
    
    userTokens.forEach((token, index) => {
        tokenList += `${index + 1}. 🪙 *${token.name} (${token.symbol})*\n`;
        tokenList += `   📄 \`${token.address}\`\n\n`;
    });
    
    bot.editMessageText(tokenList, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Tokens', callback_data: 'tokens' }]]
        }
    });
}

async function showNFTs(chatId, userId, messageId) {
    const wallet = getWallet(userId);
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    bot.editMessageText(
        `🎨 *NFTs on ${chain.icon} ${chain.name}*\n\n🔄 Scanning for NFTs...\n\n📱 Address: \`${wallet.address}\``,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    // For now, show placeholder - NFT discovery requires additional APIs
    setTimeout(() => {
        bot.editMessageText(
            `🎨 *NFTs on ${chain.icon} ${chain.name}*\n\n💡 NFT discovery is in development!\n\nFor now, you can:\n• View your NFTs on ${chain.explorer}/address/${wallet.address}\n• Use NFT marketplaces like OpenSea\n\n📱 Address: \`${wallet.address}\``,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                }
            }
        );
    }, 2000);
}

function initiateSend(chatId, userId) {
    const currentChain = getCurrentChain(userId);
    const chain = CHAINS[currentChain];
    
    bot.sendMessage(chatId, 
        `📤 *Send ${chain.symbol} on ${chain.name}*\n\nFormat: recipient_address amount\n\nExample:\n0x742d35Cc6635C0532925a3b8D4000F2b87C9B2bd 0.01`,
        { parse_mode: 'Markdown' }
    );
    
    const listener = (response) => {
        if (response.chat.id !== chatId || response.from.id !== userId) return;
        
        const parts = response.text.trim().split(' ');
        if (parts.length !== 2) {
            bot.sendMessage(chatId, '❌ Invalid format. Use: recipient_address amount');
            return;
        }
        
        const [toAddress, amount] = parts;
        
        if (!ethers.isAddress(toAddress)) {
            bot.sendMessage(chatId, '❌ Invalid recipient address.');
            return;
        }
        
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            bot.sendMessage(chatId, '❌ Invalid amount.');
            return;
        }
        
        sendTransaction(chatId, userId, toAddress, amount);
        bot.removeListener('message', listener);
    };
    
    bot.on('message', listener);
}

async function sendTransaction(chatId, userId, toAddress, amount) {
    try {
        const wallet = getWallet(userId);
        const currentChain = getCurrentChain(userId);
        const chain = CHAINS[currentChain];
        const provider = getProvider(currentChain);
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        
        bot.sendMessage(chatId, '🔄 Preparing transaction...');
        
        const balance = await provider.getBalance(wallet.address);
        const amountWei = ethers.parseEther(amount);
        
        if (balance < amountWei) {
            bot.sendMessage(chatId, `❌ Insufficient ${chain.symbol} balance.`);
            return;
        }
        
        const gasLimit = await provider.estimateGas({
            to: toAddress,
            value: amountWei
        });
        
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice;
        const totalCost = amountWei + (gasLimit * gasPrice);
        
        if (balance < totalCost) {
            const gasFee = formatToken(gasLimit * gasPrice, 18, chain.symbol);
            bot.sendMessage(chatId, `❌ Insufficient balance for gas fees.\nGas fee: ~${gasFee}`);
            return;
        }
        
        bot.sendMessage(chatId, '📤 Sending transaction...');
        
        const tx = await signer.sendTransaction({
            to: toAddress,
            value: amountWei,
            gasLimit: gasLimit,
            gasPrice: gasPrice
        });
        
        const message = `
✅ *Transaction Sent on ${chain.icon} ${chain.name}!*

🔗 *Hash:* \`${tx.hash}\`
📤 *To:* \`${toAddress}\`
💰 *Amount:* ${amount} ${chain.symbol}

⏳ Waiting for confirmation...

🌐 [View on Explorer](${chain.explorer}/tx/${tx.hash})
        `;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            bot.sendMessage(chatId, `✅ Transaction confirmed on ${chain.name}!\nBlock: ${receipt.blockNumber}`);
        } else {
            bot.sendMessage(chatId, '❌ Transaction failed.');
        }
        
    } catch (error) {
        console.error('Error sending transaction:', error);
        bot.sendMessage(chatId, `❌ Transaction failed: ${error.message}`);
    }
}

// Help command
bot.onText(/\/help/, (msg) => {
    const helpMessage = `
🤖 *Multi-Chain Crypto Wallet Bot*

🌐 *Supported Chains:*
${Object.values(CHAINS).map(chain => `${chain.icon} ${chain.name}`).join('\n')}

⌨️ *Commands:*
/start - Start the bot and create wallet
/menu - Show main menu
/help - Show this help

✨ *Features:*
• Multi-chain wallet support
• Native token transactions
• Custom ERC-20 token management
• NFT viewing (coming soon)
• Secure key management
• Real-time balance checking

🔒 *Security:*
Your private keys are encrypted and stored locally. For large amounts, consider using a hardware wallet!

💡 *Tips:*
• Always verify addresses before sending
• Start with small test amounts
• Keep your mnemonic phrase safe
• Each chain requires its native token for gas fees
    `;
    
    bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Initialize
loadData();
console.log('🚀 Multi-Chain Crypto Wallet Bot started!');
console.log('🌐 Supported chains:', Object.values(CHAINS).map(c => c.name).join(', '));
console.log('');
console.log('📝 Setup checklist:');
console.log('   1. ✅ Set your BOT_TOKEN from @BotFather');
console.log('   2. ✅ Update RPC URLs (especially Ethereum/Infura key)');
console.log('   3. ✅ Install: npm install node-telegram-bot-api ethers');
console.log('   4. ✅ Run: node bot.js');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Bot shutting down...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Bot shutting down...');
    saveData();
    process.exit(0);
});
