import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { CLASSES, AREAS, HUNTING_ENEMIES, FISHING_LOOT, RARITY, LOOT_TABLES, SHOP_ITEMS, EQUIPMENT_ITEMS, GACHA_LOOT, QUESTS } from '../data/rpg_data.js';

const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

// --- HELPER: Database Utilities ---
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

// --- (BARU) HELPER: Cooldown & Area ---

/**
 * Mengecek apakah sebuah command sedang dalam cooldown.
 * Mengembalikan 0 jika siap, atau sisa waktu (detik) jika cooldown.
 */
function checkCooldown(userData, commandName) {
    const cooldowns = userData.meta.cooldowns || {};
    const lastUsed = cooldowns[commandName];
    if (!lastUsed) return 0; // Belum pernah dipakai

    const COOLDOWN_DURATIONS = {
        'hunt': 5 * 60 * 1000, // 5 menit
        'fish': 5 * 60 * 1000, // 5 menit
        'explore': 10 * 60 * 1000, // (BARU) 10 menit
        'convert': 0,
    };

    const duration = COOLDOWN_DURATIONS[commandName] || 60000;
    const anNow = Date.now();
    const timeLeft = lastUsed + duration - anNow;

    if (timeLeft > 0) {
        return Math.ceil(timeLeft / 1000); // Kembalikan sisa detik
    }
    return 0; // Siap
}

/**
 * Mengatur cooldown untuk sebuah command.
 */
function setCooldown(userData, commandName) {
    if (!userData.meta.cooldowns) {
        userData.meta.cooldowns = {};
    }
    userData.meta.cooldowns[commandName] = Date.now();
}

/**
 * Menentukan Area Tier berdasarkan level RPG pemain.
 */
function getAreaByLevel(playerLevel) {
    let currentArea = null;
    // Loop melalui semua area yang kita impor dari rpg_data.js
    for (const areaKey in AREAS) {
        const area = AREAS[areaKey];
        if (playerLevel >= area.level_req) {
            currentArea = area; // Set area ini
        } else {
            break; // Stop jika level pemain tidak cukup
        }
    }
    return currentArea; // Kembalikan area tertinggi yang valid
}

/**
 * Menghasilkan loot berdasarkan area, musuh, dan keberuntungan pemain.
 */
function generateLoot(area, enemy, playerLuck) {
    const lootDrops = [];
    const areaRarities = area.rarity_range; // [ 'common', 'uncommon' ]
    const areaLootTable = LOOT_TABLES[area.id];

    for (let i = 0; i < enemy.drop_slots; i++) {
        // 1. Tentukan Rarity
        let chosenRarity = areaRarities[Math.floor(Math.random() * areaRarities.length)]; // Pilih rarity dasar (misal: common)

        // Coba upgrade rarity berdasarkan Luck
        const luckBonus = playerLuck * 0.5; //
        const upgradeRoll = Math.random() * 100;
        if (upgradeRoll < luckBonus) {
            // Sukses upgrade! (misal: dari common -> uncommon)
            const nextRarityIndex = areaRarities.indexOf(chosenRarity) + 1;
            if (nextRarityIndex < areaRarities.length) {
                chosenRarity = areaRarities[nextRarityIndex];
            }
            // (Nanti kita bisa tambahkan upgrade ke rare/epic)
        }

        // 2. Pilih Item dari Rarity itu
        const possibleItems = areaLootTable[chosenRarity];
        if (!possibleItems || possibleItems.length === 0) continue; // Lewati jika tidak ada loot

        const itemTemplate = possibleItems[Math.floor(Math.random() * possibleItems.length)];

        // 3. Tentukan Kualitas Item
        //
        const baseQuality = 50 + (Math.random() * 25); // Kualitas dasar: 50-75%
        const qualityBonus = playerLuck * 0.5; // Bonus 0.5% per poin Luck
        const finalQuality = Math.min(100, Math.floor(baseQuality + qualityBonus)); // Batasi di 100%

        // 4. Masukkan ke hasil drop
        lootDrops.push({
            id: itemTemplate.id,
            name: itemTemplate.name,
            rarity: chosenRarity,
            quality: finalQuality,
            value: Math.floor(itemTemplate.base_value * RARITY[chosenRarity].value_mult)
        });
    }
    return lootDrops;
}

/**
 * Menjalankan roll Gacha berdasarkan probabilitas yang ditentukan.
 * Menggunakan data RARITY untuk persentase.
 */
function rollGacha(lootTable) {
    let cumulativeChance = 0;
    const roll = Math.random() * 100; // Roll antara 0 hingga 100

    // Urutkan Rarity dari yang terendah ke tertinggi (Common -> Divine)
    const rarities = Object.keys(RARITY);

    // Loop melalui Rarity untuk menemukan yang cocok dengan roll
    for (const rarityKey of rarities) {
        const rarityData = RARITY[rarityKey];

        // Tambahkan persentase chance (misal: Common 65%)
        cumulativeChance += rarityData.drop_chance; 

        if (roll < cumulativeChance && lootTable[rarityKey]) {
            // Rarity tercapai, pilih item acak dari loot table
            const items = lootTable[rarityKey];
            const itemTemplate = items[Math.floor(Math.random() * items.length)];

            // Hitung nilai dan kualitas
            const itemQuality = Math.floor(Math.random() * 50) + 50;
            const itemValue = Math.floor(itemTemplate.base_value * rarityData.value_mult);

            return {
                id: itemTemplate.id,
                name: itemTemplate.name,
                rarity: rarityKey,
                quality: itemQuality,
                value: itemValue,
                type: itemTemplate.type,
                stats: itemTemplate.stats // Bisa undefined
            };
        }
    }

    // Fallback (seharusnya tidak pernah tercapai)
    return null; 
}

/**
 * (BARU HELPER) Menghitung total Gacha Tickets dari array inventory.
 */
function countGachaTickets(items) {
    return items.filter(item => item.id === 'gacha_ticket_basic').length;
}

/**
 * (BARU HELPER) Menghapus satu Gacha Ticket dari array inventory.
 * HANYA menghapus item PERTAMA yang ditemukan.
 */
function consumeGachaTicket(userData) {
    const index = userData.inventory.items.findIndex(item => item.id === 'gacha_ticket_basic');
    if (index > -1) {
        userData.inventory.items.splice(index, 1); // Hapus 1 item di index itu
        return true;
    }
    return false;
}

/**
 * (BARU HELPER) Memastikan user (terutama user lama) memiliki data quest.
 */
function ensureQuestData(userData) {
    if (typeof userData.rpg.active_quest_id === 'undefined') {
        userData.rpg.active_quest_id = null;
    }
    if (typeof userData.rpg.completed_quests === 'undefined') {
        userData.rpg.completed_quests = [];
    }
    if (typeof userData.rpg.quest_progress === 'undefined') {
        userData.rpg.quest_progress = 0;
    }
}

async function checkAndProcessRpgLevelUp(userData, interaction) {
    const rpg = userData.rpg;
    const requiredXp = rpg.level * 250; 

    if (rpg.xp < requiredXp) {
        return; // Belum cukup XP
    }

    // --- LEVEL UP! ---
    rpg.level++;
    rpg.xp -= requiredXp; 

    // Cari ID class dan Stat Gains
    const classId = Object.keys(CLASSES).find(key => CLASSES[key].name === rpg.stats.class);
    if (!classId) return;

    const gains = CLASSES[classId].stat_gains;

    // Terapkan peningkatan stats
    rpg.stats.hp += gains.hp;
    rpg.stats.mana += gains.mana;
    rpg.stats.luck += gains.luck;
    rpg.stats.spirit_bond += gains.spirit_bond;
    rpg.stats.corruption += gains.corruption;

    // Kirim pesan Level Up
    const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Emas
        .setTitle(`🎉 RPG LEVEL UP! 🎉`)
        .setDescription(`Hmph. Don't get cocky. **${interaction.user}** just reached **RPG Level ${rpg.level}**!`) // <-- Menggunakan ${interaction.user} untuk mention
        .addFields(
            { name: 'Stats Increased', value: `❤️ +${gains.hp} HP\n💧 +${gains.mana} Mana\n🍀 +${gains.luck} Luck\n👻 +${gains.spirit_bond} Spirit\n💀 +${gains.corruption} Corruption` }
        );

    // Cek apakah area baru terbuka
    const newArea = getAreaByLevel(rpg.level);
    const oldArea = getAreaByLevel(rpg.level - 1);
    if (newArea && oldArea && newArea.id !== oldArea.id) {
        embed.addFields({ name: '✨ New Area Unlocked!', value: `You can now hunt in the **${newArea.name}**!` });
    }

    // Kirim sebagai pesan terpisah (followUp akan selalu PUBLIK di channel yang sama)
    await interaction.followUp({ 
        content: `**ATTENTION!** ${interaction.user} has leveled up!`, // Pesan mention yang menarik perhatian
        embeds: [embed] 
    });
}

// --- AKHIR HELPER ---

// --- HELPER: Class Emojis ---
const CLASS_EMOJIS = {
    'The Bully': '🛡️',
    'The Punk': '🗡️',
    'The Dreamer': '✨',
    'The Imp': '👾',
    'The Idol': '🎤',
    'The Jester': '🃏',
    'The Revenant': '💀',
    'The Muse': '🎶',
    'The Pumpkin Night': '🎃', // <-- BARU
    'The Alter Ego': '🎭', // <-- BARU
    'None': '❓'
};

// =================================================================================
// === FUNGSI EKSEKUSI SUBCOMMAND RPG
// =================================================================================

/**
 * 1. Menampilkan RPG Stats dari user (/rpg account)
 */
async function executeAccount(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const users = loadUsers();
    const userData = users[targetUser.id];

    if (!userData) {
        return interaction.editReply({
            content: `Hmph. **${targetUser.username}** hasn't started their punk journey yet. Tell them to chat first!`,
            ephemeral: true
        });
    }

    // Ambil data v2.1 dari database
    const profile = userData.profile;
    const rpg = userData.rpg;
    const economy = userData.economy; 

    const currentClass = rpg.stats.class;
    const classEmoji = CLASS_EMOJIS[currentClass];
    const displayName = profile.custom_name || targetUser.username;

    // --- (LOGIKA BARU: HITUNG TOTAL STATS, TERMASUK ATK/DEF) ---
    const totalStats = { 
        hp: rpg.stats.hp, 
        mana: rpg.stats.mana, 
        luck: rpg.stats.luck, 
        spirit_bond: rpg.stats.spirit_bond, 
        corruption: rpg.stats.corruption,
        atk: 0, // Base ATK (dari Class, tapi kita set 0 dulu)
        def: 0  // Base DEF (dari Class, tapi kita set 0 dulu)
    };

    const equipmentList = Object.values(rpg.equipment).filter(Boolean);
    let equipmentMsg = ''; 

    for (const item of equipmentList) {
        if (item && item.stats) {
            // Tambahkan bonus stats dari item
            totalStats.hp += (item.stats.hp || 0);
            totalStats.mana += (item.stats.mana || 0);
            totalStats.luck += (item.stats.luck || 0);
            totalStats.spirit_bond += (item.stats.spirit_bond || 0);
            totalStats.corruption += (item.stats.corruption || 0);
            // --- (PERBAIKAN STATS) ---
            totalStats.atk += (item.stats.atk || 0);
            totalStats.def += (item.stats.def || 0);
            // ---
            
            equipmentMsg += `\n*+ ${item.name}*`; 
        }
    }
    // --- (AKHIR LOGIKA BARU) ---
    
    // Buat Embed
    const embed = new EmbedBuilder()
        .setColor(0x8A2BE2) 
        .setTitle(`⚔️ ${displayName}'s Combat Status 😈`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Title:** *${profile.title}*${equipmentMsg}`)
        .addFields(
            // Stats Dasar
            { 
                name: 'Level & Class', 
                value: `**RPG Lv. ${rpg.level}**\n${classEmoji} **${currentClass}**`, 
                inline: true 
            },
            { 
                name: 'Health & Mana (Total)', 
                value: `❤️ **${totalStats.hp}** HP\n💧 **${totalStats.mana}** Mana`, 
                inline: true 
            },
            // --- (FIELD BARU UNTUK ATK/DEF) ---
            { 
                name: 'Attack & Defense (Total)', 
                value: `⚔️ **${totalStats.atk}** ATK\n🛡️ **${totalStats.def}** DEF`, 
                inline: true 
            },
            // ---
            { 
                name: 'Core Stats (Total)', 
                value: `🍀 **${totalStats.luck}** Luck\n👻 **${totalStats.spirit_bond}**% Spirit\n💀 **${totalStats.corruption}**% Corruption`, 
                inline: false 
            },
            { 
                name: 'RPG XP Progress', 
                value: `\`${rpg.xp} / ${rpg.level * 250}\` XP`, 
                inline: false 
            },
            {
                name: '💰 Baddie Bucks (Main Currency)',
                value: `**${economy.baddie_bucks}** BB`,
                inline: false
            },
            // Equipment
            { 
                name: '\u200b', 
                value: '**\u200b**', 
                inline: false 
            },
            // --- (PERBAIKAN TAMPILAN [Object Object]) ---
            { 
                name: '🗡️ Weapon', 
                value: rpg.equipment.weapon ? `**${rpg.equipment.weapon.name}**` : 'None (Coward)', 
                inline: true 
            },
            { 
                name: '🛡️ Armor/Acc.', 
                value: rpg.equipment.armor ? `**${rpg.equipment.armor.name}**` : 'None (Naked)', 
                inline: true 
            }
        )
        // --- (PERUBAHAN FOOTER) ---
        .setFooter({ text: `Use /hunt or /fish to earn more Baddie Bucks!` });
    
    await interaction.editReply({ embeds: [embed] });
}


/**
 * 2. Mengatur Class RPG untuk user (/rpg setclass)
 */
async function executeSetClass(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userData = users[interaction.user.id];

    // Cek jika user tidak ada atau sudah punya class
    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first, then pick a class, loser.');
    }
    if (userData.rpg.stats.class !== 'None') {
        return interaction.editReply(`Ugh. You're already a **${userData.rpg.stats.class}**. You can't change your fate now. Sucks to be you.`);
    }

    const chosenClassId = interaction.options.getString('name');
    const classData = CLASSES[chosenClassId]; // Ambil data dari rpg_data.js

    // Terapkan stats baru
    userData.rpg.stats = { ...classData.base_stats }; // Salin semua base_stats (HP, Mana, Luck, dll)
    userData.rpg.stats.class = classData.name; // Atur nama class
    // Simpan stats lama (level, xp)
    userData.rpg.level = users[interaction.user.id].rpg.level; 
    userData.rpg.xp = users[interaction.user.id].rpg.xp;

    // Simpan database
    saveUsers(users);

    const embed = new EmbedBuilder()
        .setColor(0xB19CD9)
        .setTitle(`😈 Class Selected: ${classData.emoji} ${classData.name}`)
        .setDescription(`Hmph. Fine. You are now a **${classData.name}**.\n*${classData.description}*\n\nYour base stats have been set. Don't mess this up.`)
        .addFields(
            { name: '❤️ Base HP', value: `${classData.base_stats.hp}`, inline: true },
            { name: '💧 Base Mana', value: `${classData.base_stats.mana}`, inline: true },
            { name: '🍀 Base Luck', value: `${classData.base_stats.luck}`, inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}

/**
 * 3. Berburu monster untuk BB, XP, dan Loot (/rpg hunt)
 */
async function executeHunt(interaction) {
    await interaction.deferReply();
    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    // --- Validasi (Tetap sama) ---
    if (!userData || userData.rpg.stats.class === 'None') { /* ... */ }
    const cooldownLeft = checkCooldown(userData, 'hunt');
    if (cooldownLeft > 0) { /* ... */ }

    // --- Logic Utama Hunt ---
    const area = getAreaByLevel(userData.rpg.level);
    if (!area) { /* ... */ }
    const enemyList = HUNTING_ENEMIES[area.id];
    const enemy = enemyList[Math.floor(Math.random() * enemyList.length)];
    const bbGained = Math.floor(enemy.base_bb_drop * area.bb_mult);
    const xpGained = enemy.base_xp_drop;

    // --- (PEMBARUAN LOGIC LOOT) ---
    const lootDrops = generateLoot(area, enemy, userData.rpg.stats.luck);
    // --- (AKHIR PEMBARUAN) ---

    // 4. Update Database
    userData.economy.baddie_bucks += bbGained;
    userData.rpg.xp += xpGained;
    userData.meta.monsters_hunted += 1;
    setCooldown(userData, 'hunt');

    // Simpan item ke inventory, ... }]
    if (lootDrops.length > 0) {
        userData.inventory.items.push(...lootDrops); 
    }
	
	// Cek Level Up SEBELUM menyimpan
    await checkAndProcessRpgLevelUp(userData, interaction);

    saveUsers(users);

    // 5. Kirim Pesan Sukses (Embed Diperbarui)
    const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle(`⚔️ HUNT SUCCESSFUL ⚔️`)
        .setDescription(`You went hunting in the **${area.name}** and defeated a **${enemy.name}**!`)
        .addFields(
            { name: '💰 Baddie Bucks Earned', value: `**${bbGained} BB**`, inline: true },
            { name: '✨ RPG XP Gained', value: `**${xpGained} XP**`, inline: true }
        );

    // Tambahkan field untuk loot JIKA ada
    if (lootDrops.length > 0) {
        const lootText = lootDrops
            .map(item => `[${RARITY[item.rarity].name}] ${item.name} (Q: ${item.quality}%)`)
            .join('\n');
        embed.addFields({ name: '🎁 Loot Dropped', value: lootText, inline: false });
    } else {
        embed.addFields({ name: '🎁 Loot Dropped', value: 'None... how unlucky.', inline: false });
    }

    embed.setFooter({ text: `Total Monsters Hunted: ${userData.meta.monsters_hunted}` });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * 4. Memancing ikan untuk BB dan item (/rpg fish)
 */
async function executeFish(interaction) {
    await interaction.deferReply();

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    // ... (Validasi User & Cooldown tetap sama) ...
    if (!userData) { /* ... */ }
    const cooldownLeft = checkCooldown(userData, 'fish');
    if (cooldownLeft > 0) { /* ... */ }

    // --- Logic Utama Fish ---
    const loot = FISHING_LOOT[Math.floor(Math.random() * FISHING_LOOT.length)];
    const bbGained = Math.floor(loot.base_value + (Math.random() * 10 - 5));

    // --- (BARU) Beri XP untuk mancing ---
    const xpGained = 10; // Flat 10 XP untuk mancing

    // 4. Update Database
    userData.economy.baddie_bucks += bbGained;
    userData.rpg.xp += xpGained; // <-- TAMBAHKAN INI
    userData.meta.fish_caught += 1;
    setCooldown(userData, 'fish');
	
	const itemQuality = Math.floor(Math.random() * 50) + 50; // Kualitas 50-100%
    const itemValue = Math.floor(loot.base_value * RARITY[loot.rarity].value_mult);
    
    const fishItem = {
        id: loot.id,
        name: loot.name,
        rarity: loot.rarity,
        quality: itemQuality,
        value: itemValue
    };

    userData.inventory.items.push(fishItem);

    // Cek Level Up SEBELUM menyimpan
    await checkAndProcessRpgLevelUp(userData, interaction); // <-- TAMBAHKAN INI

    saveUsers(users);

    // 5. Kirim Pesan Sukses (Embed Diperbarui)
    const embed = new EmbedBuilder()
        .setColor(0x2196F3) 
        .setTitle(`🎣 FISHING SUCCESSFUL 🎣`)
        .setDescription(`You cast your line into the murky water and caught a **${loot.name}**!`)
        .addFields(
            { name: '💰 Baddie Bucks Earned', value: `**${bbGained} BB**`, inline: true },
            { name: '✨ RPG XP Gained', value: `**${xpGained} XP**`, inline: true } // <-- TAMBAHKAN INI
        )
        .setFooter({ text: `Total Fish Caught: ${userData.meta.fish_caught}` });

    await interaction.editReply({ embeds: [embed] });
}


/**
 * 5. Mengubah BMN menjadi BB (/rpg convert)
 */
async function executeConvert(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];
    const amountToConvert = interaction.options.getInteger('amount');

    // --- Validasi 1: Cek User ---
    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first.');
    }

    // --- Validasi 2: Cek Jumlah BMN ---
    if (amountToConvert <= 0) {
        return interaction.editReply('You have to convert at least 1 BMN. Don\'t be stupid.');
    }
    if (userData.economy.black_musical_notes < amountToConvert) {
        return interaction.editReply(`You're too poor. You only have **${userData.economy.black_musical_notes} BMN**. You can't convert **${amountToConvert} BMN**.`);
    }

    // --- Logic Utama Konversi ---
    // (Kita ubah menjadi 100 BMN = 1 BB agar lebih mudah)
    const CONVERSION_RATE = 100; // 100 BMN = 1 BB
    const bbGained = Math.floor(amountToConvert / CONVERSION_RATE);

    // Cek jika hasilnya 0 (misal, convert 50 BMN)
    if (bbGained <= 0) {
        return interaction.editReply(`You need to convert at least **${CONVERSION_RATE} BMN** to get **1 BB**.`);
    }

    // 4. Update Database
    userData.economy.black_musical_notes -= (bbGained * CONVERSION_RATE); // Hanya kurangi BMN yang benar-benar terkonversi
    userData.economy.baddie_bucks += bbGained;
    
    saveUsers(users);

    // 5. Kirim Pesan Sukses
    await interaction.editReply(`Fine. You converted **${bbGained * CONVERSION_RATE} BMN** into **${bbGained} BB**. Don't waste it.`);
}

/**
 * 6. Menampilkan inventory pemain (/rpg inventory)
 */
async function executeInventory(interaction) {
    await interaction.deferReply();

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first.');
    }

    const economy = userData.economy;
    const inventory = userData.inventory.items; 
    const ticketCount = countGachaTickets(inventory); // <-- HITUNG DARI ARRAY

    const embed = new EmbedBuilder()
        .setColor(0x9E9E9E) 
        .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
        .addFields(
            { name: '💰 Baddie Bucks (Main)', value: `**${economy.baddie_bucks} BB**`, inline: true },
            { name: '🎶 Black Musical Notes (Premium)', value: `**${economy.black_musical_notes} BMN**`, inline: true },
            { name: '🎟️ Gacha Tickets', value: `**${ticketCount}**`, inline: true } // <-- Tampilkan yang benar
        );

    if (inventory.length === 0) {
        embed.setDescription('Your inventory is empty. Go hunt or fish, lazybones.');
    } else {
        // Kita hanya tampilkan 25 item pertama agar tidak spam
        const itemsText = inventory
            .slice(0, 25)
            .map(item => {
                const rarityColor = RARITY[item.rarity].name;
                return `[${rarityColor}] **${item.name}** (Q: ${item.quality}%) - \`${item.value} BB\``;
            })
            .join('\n');

        embed.addFields({ name: 'Items', value: itemsText });
        if (inventory.length > 25) {
            embed.setFooter({ text: `...and ${inventory.length - 25} more items.` });
        }
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * 7. Menjual item dari inventory (/rpg sell)
 */
async function executeSell(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];
    
    // --- (PERBAIKAN 1) ---
    // Ambil input mentah dari user. Bisa berupa ID ('slime_gel') atau NAMA ('Slime Gel')
    const itemInput = interaction.options.getString('item').toLowerCase(); 
    
    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first.');
    }

    // --- Logic Utama Sell ---
    let totalValue = 0;
    let itemsSold = 0;
    const newInventory = []; 
    let itemName = ''; // Kita akan simpan nama item yang benar di sini

    for (const item of userData.inventory.items) {
        
        // --- (PERBAIKAN 2) ---
        // Cek apakah input cocok dengan ID item ATAU nama item (dibuat lowercase)
        if (item.id === itemInput || item.name.toLowerCase() === itemInput) {
            totalValue += item.value;
            itemsSold++;
            itemName = item.name; // Simpan nama yang benar (misal: "Slime Gel")
        } else {
            newInventory.push(item); // Masukkan kembali item yang tidak dijual
        }
    }

    // --- Validasi ---
    if (itemsSold === 0) {
        // Tampilkan input asli yang diketik user
        return interaction.editReply(`Ugh. You don't even have any \`${interaction.options.getString('item')}\` to sell.`);
    }

    // 4. Update Database
    userData.inventory.items = newInventory; 
    userData.economy.baddie_bucks += totalValue; 

    saveUsers(users);

    // 5. Kirim Pesan Sukses
    await interaction.editReply(`Hmph. Fine. You sold **${itemsSold}x ${itemName}** for **${totalValue} BB**.\nDon't spend it all in one place... or do, I don't care.`);
}

/**
 * 8. Menjelajah untuk BB (risiko rendah) (/rpg explore)
 */
async function executeExplore(interaction) {
    await interaction.deferReply();

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    // --- Validasi 1: Cek User ---
    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first, then you can explore, loser.');
    }
	
	ensureQuestData(userData); // Migrasi data quest

    // --- Validasi 2: Cek Cooldown ---
    const cooldownLeft = checkCooldown(userData, 'explore');
    if (cooldownLeft > 0) {
        return interaction.editReply(`You're tired of walking. Explore again in **${cooldownLeft} seconds**.`);
    }

    // --- Logic Utama Explore ---
    
    // 1. Hitung Hadiah
    const bbGained = Math.floor(Math.random() * 41) + 10; // 10-50 BB
	
	// --- (LOGIKA QUEST BARU) ---
    let questMessage = '';
    const activeQuest = QUESTS[userData.rpg.active_quest_id];

    if (activeQuest && activeQuest.type === 'activity' && activeQuest.objective.activity === 'explore') {
        // Cek apakah progress masih kurang
        if (userData.rpg.quest_progress < activeQuest.objective.count) {
            userData.rpg.quest_progress++;
            questMessage = `\n**[Quest Progress: ${userData.rpg.quest_progress}/${activeQuest.objective.count}]**`;
        }
    }
    // --- (AKHIR LOGIKA QUEST) ---

    // 2. Update Database
    userData.economy.baddie_bucks += bbGained;
    setCooldown(userData, 'explore'); // Set cooldown

    saveUsers(users);

    // 3. Kirim Pesan Sukses
    const embed = new EmbedBuilder()
        .setColor(0xFF9800) // Oranye
        .setTitle(`🧭 EXPLORATION COMPLETE 🧭`)
        .setDescription(`You wandered around and found some spare change.`)
        .addFields(
            { name: '💰 Baddie Bucks Found', value: `**${bbGained} BB**`, inline: true }
        )
        .setFooter({ text: `You can explore again in 10 minutes.` });
    
    await interaction.editReply({ embeds: [embed] });
}

/**
 * 9. Memakai Equipment dari inventory (/rpg equip)
 */
async function executeEquip(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];
    const itemIdToEquip = interaction.options.getString('item');

    if (!userData || userData.rpg.stats.class === 'None') {
        return interaction.editReply('You must choose a class first and have an active account.');
    }

    // --- 1. Cari Item di Inventory ---
    // Gunakan findIndex untuk menemukan item pertama yang cocok
    const itemIndex = userData.inventory.items.findIndex(item => item.id === itemIdToEquip);

    if (itemIndex === -1) {
        return interaction.editReply(`Ugh. Item ID \`${itemIdToEquip}\` not found in your inventory.`);
    }

    const itemToEquip = userData.inventory.items[itemIndex];

    // --- 2. Validasi Equipment Type ---
    if (!itemToEquip.type || (itemToEquip.type !== 'weapon' && itemToEquip.type !== 'armor' && itemToEquip.type !== 'accessory')) {
        return interaction.editReply(`\`${itemToEquip.name}\` is not equippable. It is a consumable or material.`);
    }

    // --- 3. Validasi Level Requirement ---
    if (itemToEquip.level_req && userData.rpg.level < itemToEquip.level_req) {
        return interaction.editReply(`You need **RPG Level ${itemToEquip.level_req}** to equip **${itemToEquip.name}**.`);
    }
    
    // Tentukan slot yang akan diisi
    let slot = itemToEquip.type;
    // Equipment Accessory (Choker) akan ditempatkan di slot 'armor' untuk kesederhanaan.
    if (slot === 'accessory') slot = 'armor'; 

    // --- 4. Lepas Item Lama (Jika Ada) ---
    const oldItem = userData.rpg.equipment[slot];
    if (oldItem) {
        // Pindahkan item lama kembali ke inventory
        userData.inventory.items.push(oldItem);
    }

    // --- 5. Lakukan Equip ---
    // Hapus item dari inventory
    userData.inventory.items.splice(itemIndex, 1);
    
    // Pindahkan item baru ke slot equipment
    userData.rpg.equipment[slot] = itemToEquip; 

    saveUsers(users);

    const oldItemMsg = oldItem ? ` and unequipped **${oldItem.name}**` : '';
    await interaction.editReply(`😈 You equipped **${itemToEquip.name}** to your ${slot} slot${oldItemMsg}. Your stats are now updated!`);
}

// =================================================================================
// === SHOP ROUTER DAN SUBCOMMANDS
// =================================================================================

/**
 * 10. Menampilkan item yang dijual (/rpg shop view)
 */
async function executeShopView(interaction) {
    await interaction.deferReply();

    const users = loadUsers();
    const userData = users[interaction.user.id];
    const userBB = userData ? userData.economy.baddie_bucks : 0;

    const embed = new EmbedBuilder()
        .setColor(0x000000) 
        .setTitle('🛒 Kuromi\'s Black Market Shop 😈')
        .setDescription(`You currently have **${userBB} BB**.\nUse \`/rpg shop buy [item]\` to purchase goods.`);

    // --- KATEGORI 1: CONSUMABLES (Potions, Utility) ---
    const consumablesText = Object.values(SHOP_ITEMS)
        .map(item => {
            const rarityColor = RARITY[item.rarity].name;
            return `**[${rarityColor}] ${item.name}**\n\`ID: ${item.id}\` — **${item.cost} BB**\n*${item.description}*`;
        })
        .join('\n\n');
    embed.addFields({ name: '🧪 Consumables & Utility', value: consumablesText, inline: false });

    // --- KATEGORI 2: EQUIPMENT (Weapon, Accessory) ---
    const equipmentText = Object.values(EQUIPMENT_ITEMS)
        .map(item => {
            const rarityColor = RARITY[item.rarity].name;
            return `**[${rarityColor}] ${item.name}** (${item.type})\n\`ID: ${item.id}\` — **${item.cost} BB** (Lv. ${item.level_req}+)\n*Bonus Stats: HP ${item.stats.hp || 0} / Mana ${item.stats.mana || 0} / Corr ${item.stats.corruption || 0}...*`;
        })
        .join('\n\n');
    embed.addFields({ name: '⚔️ Permanent Equipment', value: equipmentText, inline: false });

    embed.setFooter({ text: 'Warning: All sales are final. I keep the money.' });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * 11. Membeli item dari toko (/rpg shop buy)
 */
async function executeShopBuy(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];
    
    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first.');
    }

    const itemId = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount') || 1;
    
    // --- Ambil Data dari Salah Satu Objek ---
    let itemData = SHOP_ITEMS[itemId] || EQUIPMENT_ITEMS[itemId];

    // --- Validasi 1: Item & Jumlah ---
    if (!itemData) {
        return interaction.editReply(`Ugh. That item (\`${itemId}\`) is not for sale.`);
    }
    if (amount <= 0) {
        return interaction.editReply('You must buy at least 1 item.');
    }

    const totalCost = itemData.cost * amount;

    // --- Validasi 2: Cek Uang ---
    if (userData.economy.baddie_bucks < totalCost) {
        return interaction.editReply(`You are too poor! You need **${totalCost} BB** but only have **${userData.economy.baddie_bucks} BB**.`);
    }
    
    // --- Validasi 3 (BARU): Cek Level untuk Equipment ---
    if (itemData.level_req && userData.rpg.level < itemData.level_req) {
        return interaction.editReply(`You are too weak! You need **RPG Level ${itemData.level_req}** to buy **${itemData.name}**.`);
    }

    // --- Logic Beli ---
    
    // 1. Kurangi uang
    userData.economy.baddie_bucks -= totalCost;

    // 2. Tambahkan item ke inventory.
    for (let i = 0; i < amount; i++) {
        const itemToInventory = {
            id: itemData.id,
            name: itemData.name,
            rarity: itemData.rarity,
            quality: 100, 
            value: itemData.cost * 0.5 
        };
        // Jika ini equipment, tambahkan properti stats.
        if (itemData.type === 'weapon' || itemData.type === 'accessory') {
            itemToInventory.type = itemData.type;
            itemToInventory.stats = itemData.stats;
        }
        
        userData.inventory.items.push(itemToInventory); 
    }
    
    saveUsers(users);

    // 3. Kirim Pesan Sukses
    await interaction.editReply(`You bought **${amount}x ${itemData.name}** for **${totalCost} BB**.\nMy profit.`);
}


/**
 * Router utama untuk subcommand /rpg shop
 */
async function executeShopRouter(interaction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case 'view':
            await executeShopView(interaction);
            break;
        case 'buy':
            await executeShopBuy(interaction);
            break;
        default:
            await interaction.reply({ content: 'Ugh. Unknown shop command.', ephemeral: true });
    }
}

/**
 * 12. Menggunakan Gacha Ticket untuk Loot (/rpg gacha)
 */
async function executeGacha(interaction) {
    await interaction.deferReply();

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    if (!userData) {
        return interaction.editReply('Hmph. I don\'t even know you. Chat first.');
    }

    // --- Validasi Ticket ---
    const ticketCount = countGachaTickets(userData.inventory.items);
    if (ticketCount < 1) {
        return interaction.editReply(`You have **${ticketCount}** Gacha Tickets. Buy some in \`/rpg shop\` or find them through hunting!`);
    }

    // --- Logic Gacha ---

    // 1. Konsumsi Ticket (HAPUS dari array)
    if (!consumeGachaTicket(userData)) {
        // Seharusnya tidak terjadi, tapi sebagai safety
        return interaction.editReply('Error consuming ticket. Try again.');
    }

    // 2. Roll!
    const rolledItem = rollGacha(GACHA_LOOT);

    // 3. Tambahkan item hasil roll ke inventory
    if (rolledItem) {
        userData.inventory.items.push(rolledItem);
    }

    saveUsers(users);

    // 4. Kirim Pesan Hasil
    // ... (sisanya tetap sama)

    if (!rolledItem) {
        return interaction.editReply(`Ugh. The machine jammed. You lose your ticket. Tickets Remaining: ${ticketCount - 1}`);
    }

    const rarityColor = RARITY[rolledItem.rarity].color;
    const rarityName = RARITY[rolledItem.rarity].name;

    const embed = new EmbedBuilder()
        .setColor(rarityColor)
        .setTitle(`🎰 GACHA ROLL SUCCESSFUL! 🎰`)
        .setDescription(`You spent 1 Ticket and got a drop!`)
        .addFields(
            { name: '✨ Item Pulled', value: `**[${rarityName}] ${rolledItem.name}**`, inline: true },
            { name: 'Quality', value: `${rolledItem.quality}%`, inline: true }
        )
        .setFooter({ text: `Tickets Remaining: ${ticketCount - 1}` }); // count - 1

    await interaction.editReply({ embeds: [embed] });
}

/**
 * 13. Menampilkan Misi yang tersedia (/rpg quest list)
 */
async function executeQuestList(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const users = loadUsers();
    const userData = users[interaction.user.id];
    
    if (!userData) { return interaction.editReply('Hmph. Chat first.'); }
    ensureQuestData(userData); // Migrasi

    const playerLevel = userData.rpg.level;
    const activeQuestId = userData.rpg.active_quest_id;
    const completedQuests = userData.rpg.completed_quests;

    const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Emas
        .setTitle(`📰 The Paraterra Concordat Mission Board 📰`)
        .setDescription(`Misi dari para Kepala Divisi. Gunakan \`/rpg quest accept [id]\`.\n\u200b`);

    if (activeQuestId) {
        const activeQuest = QUESTS[activeQuestId];
        
        // --- (PERBAIKAN: Tampilkan Progress Aktif) ---
        let objectiveText = 'Objective: Unknown';
        if (activeQuest.type === 'activity') {
            objectiveText = `**Objective:** Use \`/${activeQuest.objective.activity}\` (**${userData.rpg.quest_progress}/${activeQuest.objective.count}** times).`;
        } else if (activeQuest.type === 'collection') {
            const userItemCount = userData.inventory.items.filter(item => item.id === activeQuest.objective.item_id).length;
            objectiveText = `**Objective:** Collect \`${activeQuest.objective.item_id}\` (**${userItemCount}/${activeQuest.objective.count}**).`;
        }
        // --- (AKHIR PERBAIKAN) ---

        embed.addFields({
            name: '⚠️ Active Mission',
            value: `**${activeQuest.title}** (Giver: ${activeQuest.giver})\n*${activeQuest.description}*\n${objectiveText}` // <-- OBJEKTIF DITAMBAHKAN
        });
        embed.addFields({ name: '\u200b', value: '\u200b' }); // Spasi
    }

    const availableQuests = Object.values(QUESTS).filter(quest => 
        playerLevel >= quest.level_req &&
        !completedQuests.includes(quest.id) &&
        quest.id !== activeQuestId
    );

    if (availableQuests.length === 0) {
        embed.addFields({ name: 'Available Missions', value: 'None. You are either too weak or you finished them all, overachiever.' });
    } else {
        availableQuests.forEach(quest => {
            // --- (PERBAIKAN: Tampilkan Objektif) ---
            let objectiveText = 'Objective: Unknown';
            if (quest.type === 'activity') {
                objectiveText = `**Objective:** Use \`/${quest.objective.activity}\` **${quest.objective.count}** times.`;
            } else if (quest.type === 'collection') {
                objectiveText = `**Objective:** Collect **${quest.objective.count}x** \`${quest.objective.item_id}\`.`;
            }
            // --- (AKHIR PERBAIKAN) ---
            
            embed.addFields({
                name: `[Lv. ${quest.level_req}] ${quest.title} (Giver: ${quest.giver})`,
                value: `*${quest.description}*\n${objectiveText}\n**ID:** \`${quest.id}\`` // <-- OBJEKTIF DITAMBAHKAN
            });
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

/**
 * 14. Menerima Misi (/rpg quest accept)
 */
async function executeQuestAccept(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];
    const questIdToAccept = interaction.options.getString('id');
    const questData = QUESTS[questIdToAccept];

    if (!userData) { return interaction.editReply('Hmph. Chat first.'); }
    ensureQuestData(userData);

    // --- Validasi (Tetap sama) ---
    if (userData.rpg.active_quest_id) { /* ... */ }
    if (!questData) { /* ... */ }
    if (userData.rpg.level < questData.level_req) { /* ... */ }
    if (userData.rpg.completed_quests.includes(questIdToAccept)) { /* ... */ }

    // --- Terima Misi ---
    userData.rpg.active_quest_id = questIdToAccept;
    userData.rpg.quest_progress = 0; // Reset progress
    saveUsers(users);

    // --- (PERBAIKAN: Tampilkan Objektif) ---
    let objectiveText = 'Objective: Unknown';
    if (questData.type === 'activity') {
        objectiveText = `Use \`/${questData.objective.activity}\` **${questData.objective.count}** times.`;
    } else if (questData.type === 'collection') {
        objectiveText = `Collect **${questData.objective.count}x** \`${questData.objective.item_id}\`.`;
    }
    // --- (AKHIR PERBAIKAN) ---

    await interaction.editReply(`**Mission Accepted: ${questData.title}**\n*Giver: ${questData.giver}*\n\n**Objective:** ${objectiveText}`);
}

/**
 * 15. Menyelesaikan Misi (/rpg quest complete)
 */
async function executeQuestComplete(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = loadUsers();
    const userId = interaction.user.id;
    const userData = users[userId];

    if (!userData) { return interaction.editReply('Hmph. Chat first.'); }
    ensureQuestData(userData);

    const activeQuestId = userData.rpg.active_quest_id;
    if (!activeQuestId) {
        return interaction.editReply('You do not have an active mission.');
    }

    const questData = QUESTS[activeQuestId];

    // --- Cek Kriteria Selesai ---
    let objectiveMet = false;
    if (questData.type === 'activity') {
        if (userData.rpg.quest_progress >= questData.objective.count) {
            objectiveMet = true;
        }
    } else if (questData.type === 'collection') {
        const requiredItem = questData.objective.item_id;
        const requiredCount = questData.objective.count;
        const userItemCount = userData.inventory.items.filter(item => item.id === requiredItem).length;

        if (userItemCount >= requiredCount) {
            objectiveMet = true;
        }
    }

    // --- Jika Belum Selesai ---
    if (!objectiveMet) {
        return interaction.editReply(`Objective not met for **${questData.title}**.\n*Check your progress or inventory.*`);
    }

    // --- PROSES HADIAH ---
    const rewards = questData.rewards;

    // 1. Hapus item (jika collection)
    if (questData.type === 'collection') {
        let itemsToRemove = questData.objective.count;
        const newInventory = [];
        // Loop terbalik agar 'splice' aman
        for (let i = userData.inventory.items.length - 1; i >= 0; i--) {
            const item = userData.inventory.items[i];
            if (item.id === questData.objective.item_id && itemsToRemove > 0) {
                itemsToRemove--; // Hapus item ini (dengan tidak memasukkannya ke inventory baru)
            } else {
                newInventory.push(item);
            }
        }
        userData.inventory.items = newInventory.reverse(); // Balikkan lagi
    }

    // 2. Tambah Hadiah (BB, XP, Item)
    userData.economy.baddie_bucks += rewards.bb;
    userData.rpg.xp += rewards.xp;

    let rewardItemsText = `+ **${rewards.bb} BB**\n+ **${rewards.xp} XP**`;

    for (const rewardItem of rewards.items) {
        // Ambil data item dari Shop atau Equipment
        const itemTemplate = SHOP_ITEMS[rewardItem.id] || EQUIPMENT_ITEMS[rewardItem.id] || GACHA_LOOT['common'].find(i => i.id === rewardItem.id); // Cari di data

        for (let i = 0; i < rewardItem.count; i++) {
            userData.inventory.items.push({
                id: itemTemplate.id,
                name: itemTemplate.name,
                rarity: itemTemplate.rarity,
                quality: 100,
                value: itemTemplate.cost ? itemTemplate.cost * 0.5 : itemTemplate.base_value,
                stats: itemTemplate.stats || undefined,
                type: itemTemplate.type || undefined
            });
        }
        rewardItemsText += `\n+ **${rewardItem.count}x ${itemTemplate.name}**`;
    }

    // 3. Reset Status Quest
    userData.rpg.active_quest_id = null;
    userData.rpg.quest_progress = 0;
    userData.rpg.completed_quests.push(activeQuestId);

    // 4. Cek Level Up (karena dapat XP)
    await checkAndProcessRpgLevelUp(userData, interaction);

    saveUsers(users);

    // 5. Kirim Pesan Sukses
    await interaction.editReply(`**MISSION COMPLETE: ${questData.title}**\n*Giver: ${questData.giver}*\n\n**Rewards:**\n${rewardItemsText}`);
}

/**
 * Router utama untuk subcommand /rpg quest
 */
async function executeQuestRouter(interaction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case 'list':
            await executeQuestList(interaction);
            break;
        case 'accept':
            await executeQuestAccept(interaction);
            break;
        case 'complete':
            await executeQuestComplete(interaction);
            break;
        default:
            await interaction.reply({ content: 'Ugh. Unknown quest command.', ephemeral: true });
    }
}

// =================================================================================
// === COMMAND EXPORT & ROUTER UTAMA
// =================================================================================

export default {
    /**
     * Definisi Slash Command (Data)
     */
    data: new SlashCommandBuilder()
        .setName('rpg')
        .setDescription('All your punk role-playing commands are here.')
        .setDMPermission(false)
        
        // --- /rpg account ---
        .addSubcommand(sub => sub
            .setName('account')
            .setDescription('Check your combat level, stats, and equipment.')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('Check another user\'s RPG stats? If you must.')
                .setRequired(false))
        )
        
        // --- /rpg setclass ---
        .addSubcommand(sub => sub
            .setName('setclass')
            .setDescription('Choose your combat class. This is PERMANENT!')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('The class you want to be.')
                .setRequired(true)
                .addChoices(
                    { name: '🛡️ The Bully (HP Tank)', value: 'bully' },
                    { name: '💀 The Revenant (Corruption Tank)', value: 'revenant' },
                    { name: '🗡️ The Punk (Damage)', value: 'punk' },
                    { name: '🎃 The Pumpkin Night (Corruption Damage)', value: 'pumpkin_night' },
                    { name: '✨ The Dreamer (Magic/Spirit)', value: 'dreamer' },
                    { name: '🎶 The Muse (Spirit/Support)', value: 'muse' },
                    { name: '🃏 The Jester (Luck/Crit Damage)', value: 'jester' },
                    { name: '👾 The Imp (Pure Luck/Loot)', value: 'imp' },
                    { name: '🎤 The Idol (Spirit/Buff)', value: 'idol' },
                    { name: '🎭 The Alter Ego (Hybrid/Luck)', value: 'alter_ego' }
                    // ---
                )
            )
        )
        
        .addSubcommand(sub => sub
            .setName('hunt')
            .setDescription('Hunt monsters in your current area for BB, XP, and loot.')
        )
            
        .addSubcommand(sub => sub
            .setName('fish')
            .setDescription('Go fishing for BB and... well, fish.')
        )

        .addSubcommand(sub => sub
            .setName('convert')
            .setDescription('Convert your premium BMN into Baddie Bucks (BB).')
            .addIntegerOption(opt => opt
                .setName('amount')
                .setDescription('How many BMN you want to convert.')
                .setRequired(true)
            )
        )
        
        .addSubcommand(sub => sub
            .setName('inventory')
            .setDescription('Check your items and currencies.')
        )
        
        .addSubcommand(sub => sub
            .setName('sell')
            .setDescription('Sell items from your inventory for Baddie Bucks.')
            .addStringOption(opt => opt
                .setName('item')
                .setDescription('The item you want to sell (sells all stacks of this item).')
                .setAutocomplete(true) // <-- Ini mengaktifkan helper autocomplete
                .setRequired(true)
            )
        )
        
        .addSubcommand(sub => sub
            .setName('explore')
            .setDescription('Explore the area for a chance to find Baddie Bucks.')
        )
        
        .addSubcommandGroup(group => group
            .setName('shop')
            .setDescription('Buy items like potions and tickets to waste your Baddie Bucks.')

            // shop view
            .addSubcommand(sub => sub
                .setName('view')
                .setDescription('View items available in the shop.')
            )

            // shop buy
            .addSubcommand(sub => sub
                .setName('buy')
                .setDescription('Purchase an item.')
                .addStringOption(opt => opt
                    .setName('item')
                    .setDescription('The item ID to purchase (e.g., small_potion).')
                    .setRequired(true))
                .addIntegerOption(opt => opt
                    .setName('amount')
                    .setDescription('How many you want to buy (default is 1).')
                    .setRequired(false))
            )
        )
        
        .addSubcommand(sub => sub
            .setName('gacha')
            .setDescription('Spend 1 Gacha Ticket for a chance at rare loot.')
        )
        
        .addSubcommand(sub => sub
            .setName('equip')
            .setDescription('Equip a Weapon, Armor, or Accessory from your inventory.')
            .addStringOption(opt => opt
                .setName('item')
                .setDescription('The item ID to equip (use /inventory to find).')
                .setRequired(true))
        )
		// --- (BARU) /rpg quest ---
		.addSubcommandGroup(group => group
			.setName('quest')
			.setDescription('View and manage missions from The Paraterra Concordat.')

			// quest list
			.addSubcommand(sub => sub
				.setName('list')
				.setDescription('View all available and active missions.')
        )

			// quest accept
			.addSubcommand(sub => sub
				.setName('accept')
				.setDescription('Accept a mission from the list.')
				.addStringOption(opt => opt
					.setName('id')
					.setDescription('The Mission ID (e.g., q01_ruins).')
					.setRequired(true))
        )

        // quest complete
        .addSubcommand(sub => sub
            .setName('complete')
            .setDescription('Attempt to complete your currently active mission.')
        )
    )
    ,
    
    /**
     * Router Utama (Execute)
     */
    async execute(interaction) {
        // Ambil Subcommand Group (misal: 'shop')
        const subcommandGroup = interaction.options.getSubcommandGroup();
        // Ambil Subcommand (misal: 'hunt', 'gacha', atau 'view'/'buy' jika di dalam group 'shop')
        const subcommand = interaction.options.getSubcommand();

        try {
            // --- 1. HANDLE GROUP COMMANDS ---
            if (subcommandGroup) {
                switch (subcommandGroup) {
                    case 'shop':
                        await executeShopRouter(interaction); // Router Group Shop
                        return; // Keluar dari fungsi setelah dijalankan
					case 'quest':
						await executeQuestRouter(interaction);
						return;
					// ---	
                    default:
                        await interaction.reply({ content: 'Ugh. Unknown RPG command group.', ephemeral: true });
                        return;
                }
            }
            
            // --- 2. HANDLE DIRECT SUBCOMMANDS ---
            switch (subcommand) {
                case 'account':
                    await executeAccount(interaction);
                    break;
                case 'setclass':
                    await executeSetClass(interaction);
                    break;
                case 'hunt':
                    await executeHunt(interaction);
                    break;
                case 'fish':
                    await executeFish(interaction);
                    break;
                case 'convert':
                    await executeConvert(interaction);
                    break;
                case 'inventory':
                    await executeInventory(interaction);
                    break;
                case 'sell':
                    await executeSell(interaction);
                    break;
                case 'explore':
                    await executeExplore(interaction);
                    break;
                case 'gacha':
                    await executeGacha(interaction);
                    break;
                case 'equip':
                    await executeEquip(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Ugh. Unknown RPG command.', ephemeral: true });
            }

        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: 'Ugh! Bot error during command execution. Try again.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ugh! Bot error during command execution. Try again.', ephemeral: true });
            }
        }
    },
    
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        if (focusedOption.name === 'item') {
            const users = loadUsers();
            const userData = users[interaction.user.id];
            
            if (userData && userData.inventory.items.length > 0) {
                // Buat daftar unik item yang dimiliki user
                const uniqueItems = {};
                for (const item of userData.inventory.items) {
                    if (!uniqueItems[item.id]) {
                        uniqueItems[item.id] = { name: `(${item.rarity}) ${item.name}`, count: 0 };
                    }
                    uniqueItems[item.id].count++;
                }
                
                // Ubah menjadi format Pilihan Discord
                choices = Object.entries(uniqueItems).map(([id, data]) => ({
                    name: `${data.name} (You have: ${data.count})`,
                    value: id // Kita kirim ID-nya, misal: 'slime_gel'
                }));
            }
        }

        // Filter pilihan berdasarkan apa yang diketik user
        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        await interaction.respond(filtered.slice(0, 25)); // Tampilkan maks 25
    }
};