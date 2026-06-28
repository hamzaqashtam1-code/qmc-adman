const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// البيانات
let mealsData = [
    { id: 1, name: "شاورما دجاج", price: 3.50, available: true },
    { id: 2, name: "بروستد كامل", price: 6.00, available: true }
];

// مسار الإدارة (يجب أن يكون بعد تعريف app)
app.get('/admin', (req, res) => {
    res.send(`
        <div dir="rtl">
            <h1>لوحة الإدارة - QMC</h1>
            ${mealsData.map(m => `
                <div style="border:1px solid #ccc; padding:10px; margin:10px;">
                    ${m.name} - ${m.available ? '✅ متاحة' : '❌ مخفية'}
                </div>
            `).join('')}
        </div>
    `);
});

// المسارات الأخرى
app.get('/', (req, res) => res.send('مرحباً بك في نظام QMC'));

app.listen(port, () => console.log('السيرفر يعمل الآن!'));
