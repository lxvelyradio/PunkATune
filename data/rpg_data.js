/*
|--------------------------------------------------------------------------
| PUNK-A-TUNE RPG: MASTER DATA FILE
|--------------------------------------------------------------------------
| Ini adalah database pusat untuk semua data statis RPG kita.
| (Stats Class, Monster, Area, Loot, dll.)
| Kita menggunakan sistem 'export default' agar bisa di-import di command manapun.
*/

// === 1. CLASS DATA (10 CLASSES + STAT GAINS) ===
export const CLASSES = {
    // Tank
    'bully': {
        id: 'bully',
        name: 'The Bully',
        emoji: '🛡️',
        description: 'Fokus pada HP dan Pertahanan.',
        base_stats: { hp: 150, mana: 30, luck: 5, spirit_bond: 0, corruption: 5 },
        stat_gains: { hp: 15, mana: 2, luck: 0, spirit_bond: 0, corruption: 0 } // High HP
    },
    'revenant': {
        id: 'revenant',
        name: 'The Revenant',
        emoji: '💀',
        description: 'Tank yang menyerap kegelapan. HP tinggi dan bonus dari Corruption.',
        base_stats: { hp: 140, mana: 40, luck: 3, spirit_bond: 0, corruption: 15 },
        stat_gains: { hp: 14, mana: 3, luck: 0, spirit_bond: 0, corruption: 1 } // High HP, High Corruption
    },
    
    // Damage
    'punk': {
        id: 'punk',
        name: 'The Punk',
        emoji: '🗡️',
        description: 'Fokus pada Serangan dan Kecepatan.',
        base_stats: { hp: 100, mana: 50, luck: 7, spirit_bond: 0, corruption: 10 },
        stat_gains: { hp: 10, mana: 5, luck: 0, spirit_bond: 0, corruption: 1 } // Balanced HP/Mana
    },
    'pumpkin_night': {
        id: 'pumpkin_night',
        name: 'The Pumpkin Night',
        emoji: '🎃',
        description: 'Pejuang jahat yang menggunakan trik dan Corruption.',
        base_stats: { hp: 100, mana: 50, luck: 10, spirit_bond: 0, corruption: 12 },
        stat_gains: { hp: 10, mana: 5, luck: 1, spirit_bond: 0, corruption: 1 } // Balanced + Luck
    },

    // Magic / Spirit
    'dreamer': {
        id: 'dreamer',
        name: 'The Dreamer',
        emoji: '✨',
        description: 'Fokus pada Mana dan Spirit.',
        base_stats: { hp: 80, mana: 100, luck: 5, spirit_bond: 10, corruption: 0 },
        stat_gains: { hp: 7, mana: 10, luck: 0, spirit_bond: 1, corruption: 0 } // Low HP, High Mana
    },
    'muse': {
        id: 'muse',
        name: 'The Muse',
        emoji: '🎶',
        description: 'Penyihir murni yang fokus pada Spirit Bond dan Mana.',
        base_stats: { hp: 90, mana: 120, luck: 5, spirit_bond: 15, corruption: 0 },
        stat_gains: { hp: 8, mana: 12, luck: 0, spirit_bond: 1, corruption: 0 } // High Mana/Spirit
    },

    // Specialist
    'jester': {
        id: 'jester',
        name: 'The Jester',
        emoji: '🃏',
        description: 'Seorang penjudi gila. Fokus pada Luck untuk critical hit.',
        base_stats: { hp: 80, mana: 60, luck: 20, spirit_bond: 0, corruption: 10 },
        stat_gains: { hp: 7, mana: 7, luck: 2, spirit_bond: 0, corruption: 0 } // High Luck
    },
    'imp': {
        id: 'imp',
        name: 'The Imp',
        emoji: '👾',
        description: 'Fokus murni pada Keberuntungan (Luck) untuk menemukan item langka.',
        base_stats: { hp: 90, mana: 50, luck: 18, spirit_bond: 5, corruption: 5 },
        stat_gains: { hp: 8, mana: 5, luck: 2, spirit_bond: 0, corruption: 0 } // High Luck
    },
    'idol': {
        id: 'idol',
        name: 'The Idol',
        emoji: '🎤',
        description: 'Fokus pada Spirit Bond dan pesona untuk support.',
        base_stats: { hp: 100, mana: 70, luck: 5, spirit_bond: 18, corruption: 0 },
        stat_gains: { hp: 10, mana: 7, luck: 0, spirit_bond: 2, corruption: 0 } // High Spirit
    },
    'alter_ego': {
        id: 'alter_ego',
        name: 'The Alter Ego',
        emoji: '🎭',
        description: 'Tidak terduga. Stats seimbang dengan bonus Luck dan Spirit.',
        base_stats: { hp: 90, mana: 90, luck: 12, spirit_bond: 5, corruption: 5 },
        stat_gains: { hp: 9, mana: 9, luck: 1, spirit_bond: 1, corruption: 0 } // All-Rounder
    }
};


// === 2. RARITY DATA (DENGAN DROP CHANCE) ===
export const RARITY = {
    'common': { name: 'Common', value_mult: 1, color: '#9E9E9E', drop_chance: 65.0 }, // Midpoint 65%
    'uncommon': { name: 'Uncommon', value_mult: 1.5, color: '#4CAF50', drop_chance: 22.5 }, // Midpoint 22.5%
    'rare': { name: 'Rare', value_mult: 2, color: '#2196F3', drop_chance: 8.5 },  // Midpoint 8.5%
    'epic': { name: 'Epic', value_mult: 3, color: '#9C27B0', drop_chance: 2.5 },  // Midpoint 2.5%
    'legendary': { name: 'Legendary', value_mult: 5, color: '#FF9800', drop_chance: 0.75 }, // Midpoint 0.75%
    'mythic': { name: 'Mythic', value_mult: 8, color: '#E91E63', drop_chance: 0.2 },  // Midpoint 0.2%
    'divine': { name: 'Divine', value_mult: 10, color: '#F44336', drop_chance: 0.05 } // Maksimal 0.05%
};


// === 3. AREA TIERS ===
//
export const AREAS = {
    'tier1': {
        id: 'tier1',
        name: 'Whispering Marsh',
        level_req: 1,
        bb_mult: 1.0,
        rarity_range: ['common', 'uncommon'] // Drop item di area ini
    },
    'tier2': {
        id: 'tier2',
        name: 'Crystal Vale', //
        level_req: 10,
        bb_mult: 1.2,
        rarity_range: ['uncommon', 'rare']
    }
    // (Kita akan tambahkan Tier 3-10 nanti)
};

// === 4. FISHING DATA ===
//
export const FISHING_LOOT = [
    { id: 'glassfin', name: 'Glassfin', rarity: 'common', base_value: 25 },
    { id: 'rusty_can', name: 'Rusty Can', rarity: 'common', base_value: 5 },
    { id: 'whisper_koi', name: 'Whisper Koi', rarity: 'uncommon', base_value: 45 },
    { id: 'ember_eel', name: 'Ember Eel', rarity: 'rare', base_value: 120 }
    // (Kita akan tambahkan sisanya nanti)
];

// === 5. HUNTING DATA ===
// (Data monster untuk Tier 1: Whispering Marsh)
export const HUNTING_ENEMIES = {
    'tier1': [
        {
            name: 'Marsh Slime',
            type: 'Normal Monster', 
            hp: 30,
            base_bb_drop: 30, 
            base_xp_drop: 20,
            drop_slots: 1 //
        },
        {
            name: 'Shadow Stalker',
            type: 'Elite Monster', 
            hp: 80,
            base_bb_drop: 100, 
            base_xp_drop: 50,
            drop_slots: 2 //
        }
    ]
};

// === 6. LOOT TABLES ===
// Item yang dijatuhkan di setiap area, diurutkan berdasarkan rarity
export const LOOT_TABLES = {
    'tier1': { // Loot untuk Whispering Marsh
        'common': [
            { id: 'slime_gel', name: 'Slime Gel', base_value: 5 },
            { id: 'marsh_weed', name: 'Marsh Weed', base_value: 3 }
        ],
        'uncommon': [
            { id: 'sturdy_stick', name: 'Sturdy Stick', base_value: 15 },
            { id: 'tattered_cloth', name: 'Tattered Cloth', base_value: 12 }
        ],
        'rare': [
            { id: 'marsh_crystal', name: 'Marsh Crystal', base_value: 50 }
        ]
    }
    // (Area lain akan ditambahkan nanti)
};

// === 7. SHOP ITEMS (POTION & UTILITY) ===
export const SHOP_ITEMS = {
    //
    'vivi_serum': {
        id: 'vivi_serum',
        name: 'Vivi\'s Recovery Serum',
        description: 'Restores 150 HP & removes one random negative status.',
        type: 'potion',
        cost: 500,
        rarity: 'epic'
    },
    //
    'ryu_grenade': {
        id: 'ryu_grenade',
        name: 'Ryu\'s Experimental Grenade',
        description: 'Can be used in combat for powerful AoE (Area) damage.',
        type: 'bomb',
        cost: 800,
        rarity: 'epic'
    },
    'gacha_ticket_basic': {
        id: 'gacha_ticket_basic',
        name: 'Gacha Ticket (Basic)',
        description: 'Used for the /rpg gacha command. Standard loot pool.',
        type: 'utility',
        cost: 1000,
        rarity: 'rare'
    },
    'lucky_charm': {
        id: 'lucky_charm',
        name: 'Lucky Charm (30m)',
        description: 'Increases Luck stat by 5% for 30 minutes.',
        type: 'buff',
        cost: 5000,
        rarity: 'epic'
    }
};

// === 8. EQUIPMENT ITEMS (FOR /rpg equip) ===
export const EQUIPMENT_ITEMS = {
    //
    'yoshi_dual_gun': {
        id: 'yoshi_dual_gun',
        name: 'Yoshi\'s Dual Gun',
        type: 'weapon',
        level_req: 10, // Hanya bisa dibeli/dipakai oleh Lv 10+
        cost: 15000,
        rarity: 'legendary',
        stats: { atk: 25, luck: 5, corruption: 5 } // Stats fiktif untuk damage/luck
    },
    //
    'zaki_choker': {
        id: 'zaki_choker',
        name: 'Zaki\'s Choker',
        type: 'accessory', // Tipe baru: Accessory
        level_req: 15, // Hanya bisa dibeli/dipakai oleh Lv 15+
        cost: 30000,
        rarity: 'mythic',
        stats: { hp: 30, mana: 200, spirit_bond: 20, corruption: 50 } // Stats sangat tinggi
    }
};

// === 9. GACHA LOOT (Loot dari Gacha Ticket) ===
export const GACHA_LOOT = {
    'common': [
        { id: 'rusty_dagger', name: 'Rusty Dagger', type: 'weapon', base_value: 50, stats: { atk: 5 } },
        { id: 'broken_armor', name: 'Broken Armor', type: 'armor', base_value: 70, stats: { def: 5 } }
    ],
    'uncommon': [
        { id: 'steel_knife', name: 'Steel Knife', type: 'weapon', base_value: 150, stats: { atk: 10 } },
        { id: 'leather_vest', name: 'Leather Vest', type: 'armor', base_value: 200, stats: { def: 10 } }
    ],
    'rare': [
        { id: 'silver_ring', name: 'Silver Ring', type: 'accessory', base_value: 500, stats: { luck: 3 } }
    ],
    'epic': [
        { id: 'shadow_boots', name: 'Shadow Boots', type: 'armor', base_value: 1500, stats: { def: 15, corruption: 5 } }
    ],
};

// === 10. QUEST DATA (The Paraterra Concordat) ===
export const QUESTS = {
    // --- TIER 1 (LVL 1-9) ---
    'q01_ruins': {
        id: 'q01_ruins',
        title: 'Mission: Ancient Ruins',
        giver: 'Mawamori Yoshida',
        level_req: 1,
        description: 'Yoshida menugaskan Team Four untuk menyelidiki reruntuhan kuno di tepi Archipelago Zone. Amati dan laporkan.', //

        type: 'activity', // Tipe misi: Selesaikan aktivitas
        objective: {
            activity: 'explore', // Command yang harus dijalankan
            count: 3 // Berapa kali
        },

        rewards: {
            xp: 200,
            bb: 500, //
            items: []
        }
    },
    'q02_lab_assist': {
        id: 'q02_lab_assist',
        title: 'Lab Assistance: "Volunteers"',
        giver: 'Prof. Ryu',
        level_req: 5,
        description: 'Ryu membutuhkan "sukarelawan" untuk menguji prototipe granat barunya. Dia membutuhkan material... yang mungkin meledak.', //

        type: 'collection', // Tipe misi: Kumpulkan item
        objective: {
            item_id: 'marsh_crystal', // Item ID dari LOOT_TABLES
            count: 5 
        },

        rewards: {
            xp: 400,
            bb: 1000,
            items: [
                { id: 'ryu_grenade', count: 1 } // Hadiah Item
            ]
        }
    },
    'q03_serum_run': {
        id: 'q03_serum_run',
        title: 'Clinic Duty: Serum Run',
        giver: 'Dr. Vivi',
        level_req: 8,
        description: 'Stok \'angel-light magic\' Dr. Vivi menipis. Dia membutuhkanmu untuk mengumpulkan 10 Spirit-infused Marsh Weed.', //

        type: 'collection', 
        objective: {
            item_id: 'marsh_weed',
            count: 10
        },

        rewards: {
            xp: 300,
            bb: 800,
            items: [
                { id: 'vivi_serum', count: 2 } // Hadiah Item
            ]
        }
    },
    
    'q04_choker_polish': {
        id: 'q04_choker_polish',
        title: 'Aesthetic Maintenance',
        giver: 'Zaki',
        level_req: 9,
        description: 'Zaki mengeluh permata di chokernya kusam. Dia membutuhkan material langka dari Marsh untuk "memolesnya".', //

        type: 'collection', 
        objective: {
            item_id: 'marsh_crystal',
            count: 3
        },

        rewards: {
            xp: 500,
            bb: 1200,
            items: [
                { id: 'gacha_ticket_basic', count: 1 }
            ]
        }
    }
    // Nanti kita tambahkan Misi Tier 2 (Crystal Vale)
}; // <-- (KURUNG KURAWAL DIPINDAHKAN KE SINI)

export default {
    CLASSES,
    RARITY,
    AREAS,
    FISHING_LOOT,
    HUNTING_ENEMIES,
    LOOT_TABLES,
    SHOP_ITEMS,
    EQUIPMENT_ITEMS,
    GACHA_LOOT,
    QUESTS
};