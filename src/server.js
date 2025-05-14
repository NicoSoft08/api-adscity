const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');         
const compression = require('compression');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;


// 🔄 Tâches CRON
const { checkFreeTrialExpiry, markPostsAsExpired } = require('./cron');
const { cleanupVerificationDocuments } = require('./middlewares/documentLifecycle');
const { deleteOldExpiredPosts } = require('./services/updateServices'); // Assure-toi que cette fonction existe
const { deletionReminder, deleteOldAdminLogs, deleteOldClientLogs, cleanupOldProfileVisits } = require('./firebase/cleanup');
const { createDefaultSuperAdmin } = require('./firebase/admin');

// 📦 Importation des routes
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const storageRoutes = require('./routes/storageRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const translateRoutes = require('./routes/translateRoutes');
const statusRoutes = require('./routes/statusRoutes');
const updateServices = require('./services/updateServices');

// 🌍 Configuration CORS
const allowedOrigins = [
    'https://adscity.net',
    'https://admin.adscity.net',
    'https://auth.adscity.net',
    'https://account.adscity.net',
    'https://dashboard.adscity.net',
    'https://help.adscity.net',
    'https://api.adscity.net', // 👈 à ajouter si c’est là que tourne ton backend
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
];

const corsOptions = {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400
};

// 🛡 Middlewares
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet());         // 👈 Sécurité HTTP
app.use(compression());   // 👈 Réduction de taille des réponses
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Une erreur est survenue.' });
});

// 🧪 Route de test
app.get('/', (req, res) => { res.send('✅ AdsCity Serveur API is running') });

// 📍 Définition des routes API
app.use('/api', updateServices);
app.use('/api/do', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/translations', translateRoutes);

// ⏰ Tâches CRON

// 🔁 Tous les jours à minuit
cron.schedule("0 0 * * *", async () => {
    console.log("🕛 Mise à jour des annonces expirées...");
    await markPostsAsExpired();
    console.log("🔎 Vérification des périodes d'essai...");
    await checkFreeTrialExpiry();
    console.log("🧹 Nettoyage des documents expirés...");
    await cleanupVerificationDocuments();
});

// 📅 Le 1er de chaque mois à 3h
cron.schedule("0 3 1 * *", async () => {
    console.log("🗑 Suppression des annonces expirées depuis 1 mois...");
    await deleteOldExpiredPosts();
    console.log("🧹 Nettoyage des visites de profil...");
    const result = await cleanupOldProfileVisits(90);
    console.log(`✅ Nettoyage terminé : ${result.usersUpdated} utilisateurs mis à jour`);
});

// 📤 Tous les dimanches à 2h
cron.schedule("0 2 * * 0", async () => {
    console.log("🔔 Envoi de rappels de suppression...");
    await deletionReminder();
    console.log("🧹 Nettoyage hebdomadaire des logs admin...");
    await deleteOldAdminLogs();
    console.log("🧹 Nettoyage hebdomadaire des logs client...");
    await deleteOldClientLogs();
});

// 🚀 Lancement du serveur
app.listen(PORT, async () => {
    console.log(`🚀 Server started at http://localhost:${PORT}`);
    await createDefaultSuperAdmin();
});
