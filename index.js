import { Client, GatewayIntentBits, Collection, Events, AttachmentBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Canvas from 'canvas';
// --- (PERBAIKAN V3) DEPENDENCY CHECK UNTUK MUSIK ---
import ffmpeg from 'ffmpeg-static';
import sodium from 'libsodium-wrappers';
import opus from '@discordjs/opus'; // <-- (PERUBAHAN) Mengimpor paket baru

console.log('[DEPENDENCY] Memuat dependensi musik...');
try {
    console.log('[DEPENDENCY] ffmpeg-static path (otomatis):', ffmpeg);
    
    await sodium.ready; // Tunggu libsodium siap
    console.log('[DEPENDENCY] libsodium-wrappers berhasil dimuat. Versi:', sodium.SODIUM_VERSION_STRING);
    
    // (PERUBAHAN) Kita cek 'OpusEncoder' dari '@discordjs/opus'
    if (opus.OpusEncoder) { 
        console.log('[DEPENDENCY] @discordjs/opus berhasil dimuat.'); 
    } else {
        throw new Error('@discordjs/opus gagal dimuat.');
    }
} catch (error) {
    console.error('[DEPENDENCY CRITICAL] Gagal memuat dependensi musik! Bot musik TIDAK akan bekerja.', error);
}
// --- (AKHIR DEPENDENCY CHECK) ---


// --- Setup ---
dotenv.config();

// --- DEKLARASI GLOBAL UNTUK __dirname (WAJIB) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------------------------------------------

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

client.musicQueue = new Map();

// --- File Path & Config Leveling ---
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');
const COOLDOWN_SECONDS = 60; 
const ACCOUNT_XP_REQUIRED = (level) => level * 100; 
const WELCOME_CHANNEL_ID = '1181584227448406117'; // <-- PASTIKAN INI ID CHANNEL YANG BENAR
const BACKGROUND_IMAGE_PATH = path.join(process.cwd(), 'assets', 'welcome_bg.png'); 

// --- Database Utilities ---
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE_PATH)) {
            const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) { console.error("[DB ERROR] Failed to load users.json:", error); }
    return {}; 
}
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) { console.error("[DB ERROR] Failed to save users.json:", error); }
}
// --- AKHIR Database Utilities ---


// --- Command Handler ---
client.commands = new Collection();
client.xpCooldowns = new Collection(); 
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.log("[SETUP] Folder 'commands' tidak ditemukan. Membuat folder...");
    fs.mkdirSync(commandsPath);
}
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath);
    try {
        const command = await import(fileUrl.href);
        if (command.default.data && command.default.execute) {
            client.commands.set(command.default.data.name, command.default);
            console.log(`[LOADER] Loaded command: ${command.default.data.name}`);
        }
    } catch (error) {
        console.error(`[LOADER ERROR] Failed to load command at ${filePath}: ${error.message}`);
    }
}
// --- AKHIR Command Handler ---


// --- Event: Saat Bot Siap (Final Stable) ---
client.on(Events.ClientReady, () => {
    console.log(`😈 ${client.user.tag} is online and ready to cause trouble!`);
    console.log('[SETUP] Font kustom dinonaktifkan. Menggunakan font Impact.'); 

    if (!fs.existsSync(USERS_FILE_PATH)) {
        console.log("[SETUP] users.json tidak ditemukan. Membuat file database baru...");
        saveUsers({});
    }
});

// --- Event: Saat Interaksi (Command ATAU Autocomplete) Digunakan ---
client.on(Events.InteractionCreate, async interaction => {
    
    // --- (PERBAIKAN 1) Ambil command-nya dulu ---
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // --- (PERBAIKAN 2) Router Interaksi ---
    try {
        if (interaction.isChatInputCommand()) {
            // Ini adalah /command, jalankan 'execute'
            await command.execute(interaction);
        
        } else if (interaction.isAutocomplete()) {
            // Ini adalah permintaan autocomplete, jalankan 'autocomplete'
            if (command.autocomplete) {
                await command.autocomplete(interaction);
            }
        }
    } catch (error) {
        console.error(`[INTERACTION ERROR] Command: ${interaction.commandName}`);
        console.error(error);
        
        // Handle balasan error
        if (interaction.isChatInputCommand()) {
            const replyOptions = { 
                content: "Ugh! Something broke and it wasn't my fault. Try again... or don't. Whatever.", 
                ephemeral: true 
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        }
    }
}); 
// --- AKHIR Event InteractionCreate ---

// --- Event: Saat Pesan Dibuat (Sistem Leveling) ---
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    // 1. Cek Cooldown XP
    const cooldownTime = COOLDOWN_SECONDS * 1000;
    const lastMessageTime = client.xpCooldowns.get(userId);
    if (lastMessageTime && (now - lastMessageTime) < cooldownTime) {
        return; 
    }
    client.xpCooldowns.set(userId, now); 

    // 2. Ambil dan Update Data User (Struktur Rapi)
    const users = loadUsers();
    
    // --- (PERBAIKAN KRUSIAL v2.3) Inisialisasi User (Menambahkan Quest Tracking) ---
    if (!users[userId]) {
        users[userId] = {
            // === PILAR 1: PROFIL & SOSIAL ===
            username: message.author.username, 
            profile: {
                title: "Newbie Punk", 
                custom_name: null,
                fav_song: null,
                badges: ["new_user"] 
            },
            
            // === PILAR 2: LEVELING & STATS (v2.3) ===
            account: { level: 1, xp: 0 },
            rpg: {
                level: 1,
                xp: 0,
                stats: { 
                    class: "None", 
                    hp: 100, 
                    mana: 50, 
                    luck: 5,           
                    spirit_bond: 0,    
                    corruption: 0      
                }, 
                equipment: { weapon: null, armor: null },
                
                // --- (BARU v2.3) ---
                active_quest_id: null,  // ID Misi yang sedang aktif
                completed_quests: [],    // Array berisi ID Misi yang sudah selesai
				quest_progress: 0       // (BARU) Counter untuk misi (misal: 0/3 explore)
                // ---
            },
            
            // === PILAR 3: EKONOMI & INVENTORY ===
            economy: {
                baddie_bucks: 0,          
                black_musical_notes: 0, 
                multipliers: { bucks: 1.0, bucks_expiry: 0 }
            },
            inventory: {
                items: [], 
                gacha_tickets: 0
            },
            
            // === PILAR 4: STATISTIK & COOLDOWN (META) ===
            meta: {
                first_seen: now,
                last_seen: now,
                message_count: 0,
                monsters_hunted: 0, 
                fish_caught: 0,     
                cooldowns: {}       
            }
        };
    }
    // --- (AKHIR BLOK INISIALISASI) ---
    
    let userData = users[userId];

    // 3. Beri XP & Cek Level Up Akun
    const baseXPGained = Math.floor(Math.random() * 11) + 15; 
    userData.account.xp += baseXPGained;
	const minBMN = 100;
    const maxBMN = 250; 
    const range = maxBMN - minBMN + 1; // Range dari 100 hingga 250 (yaitu 151 angka)
    const bmnGained = Math.floor(Math.random() * range) + minBMN; 
    userData.economy.black_musical_notes += bmnGained;
    userData.meta.message_count += 1;
    userData.meta.last_seen = now;
    userData.username = message.author.username; 

    const required = ACCOUNT_XP_REQUIRED(userData.account.level);
    
    if (userData.account.xp >= required) {
        userData.account.level += 1;
        userData.account.xp -= required; 
        
        message.channel.send(`Hmph. ${message.author}... don't get a big head. You just reached **Account Level ${userData.account.level}**. Ugh.`);
    }

    saveUsers(users);
});
// --- AKHIR Event MessageCreate ---


// --- Event: Saat Anggota Baru Bergabung (Welcome Image) ---
client.on(Events.GuildMemberAdd, async member => {
    if (member.user.bot) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) { return; }

    try {
        // --- 1. Persiapan Kanvas & Latar ---
        const canvas = Canvas.createCanvas(1024, 576); 
        const context = canvas.getContext('2d');
        const background = await Canvas.loadImage(BACKGROUND_IMAGE_PATH);
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        // --- Mengatur Teks ke Rata Tengah ---
        context.textAlign = 'center'; 
        const centerX = canvas.width / 2; 

        // --- 2. Tulis Teks "WELCOME" (FONT IMPACT) ---
        context.font = 'bold 70px Impact, sans-serif'; // <-- FONT IMPACT (Stabil)
        context.fillStyle = '#FFFFFF'; 
        context.strokeStyle = '#745a8e'; 
        context.lineWidth = 5;            
        context.strokeText('WELCOME', centerX, 450); 
        context.fillText('WELCOME', centerX, 450);   

        // --- 3. Tulis Nama Pengguna (FONT IMPACT) ---
        context.font = '50px Impact, sans-serif'; // <-- FONT IMPACT (Stabil)
        context.fillStyle = '#FFFFFF';
        const username = member.user.username.length > 15 ? member.user.username.substring(0, 15) + '...' : member.user.username;
        context.strokeStyle = '#745a8e'; 
        context.lineWidth = 5;            
        context.strokeText(username, centerX, 500); 
        context.fillText(username, centerX, 500);   

        // --- 4. Gambar Avatar (Lingkaran) ---
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Canvas.loadImage(avatarURL);
        const avatarX = centerX; 
        const avatarY = 260;     
        const avatarRadius = 110; 

        context.save();
        context.beginPath();
        context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
        context.closePath();
        context.clip();
        context.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        context.restore();

        // --- 5. Kirim Gambar ---
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
        
        channel.send({ 
            content: `Hmph. Look who showed up. Welcome to the server, ${member}.`, 
            files: [attachment] 
        });

    } catch (error) { 
        console.error("[WELCOME ERROR] Failed to create welcome image:", error);
        channel.send(`Hmph. I wanted to make a cool image for ${member}, but it broke. Whatever. Welcome.`);
    }
});
// --- AKHIR Event GuildMemberAdd ---


// --- Login ---
client.login(process.env.DISCORD_TOKEN);