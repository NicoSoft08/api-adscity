const PLAN_CONFIGS = [
    {
        id: 1,
        name: "Particulier",
        price: 0,
        validity_days: 30,
        max_ads: 3,
        max_photos: 3,
        visibility: "Basique",
        support: "24/7"
    },
    {
        id: 2,
        name: "Professionnel",
        price: 2000,
        validity_days: 30,
        max_ads: 10,
        max_photos: 9,
        visibility: "Améliorée",
        support: "24/7"
    },
    {
        id: 3,
        name: "Entreprise",
        price: 4000,
        validity_days: 30,
        max_ads: 20,
        max_photos: 12,
        visibility: "Premium",
        support: "24/7"
    }
];

const LAUNCH_PROMO = {
    code: 'LAUNCH2025',
    duration: '1 Month',
    isActive: true,
    startDate: '2025-01-01',
    endDate: '2025-02-01'
};


module.exports = {
    PLAN_CONFIGS,
    LAUNCH_PROMO,
};