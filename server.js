const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// البيانات المركزية
let systemConfig = {
    restaurantName: "مطاعم أبو يونس",
    bgImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    themeColor: "#1e4620",
    availableTables: 12
};

let mealsData = [
    { id: 1, name: "شاورما دجاج", price: 3.50, category: "شاورما", description: "شاورما على الفحم", img: "https://images.unsplash.com/photo-1649144368140-5e3692beeb51?w=200", available: true },
    { id: 2, name: "بروستد كامل", price: 6.00, category: "بروستد", description: "دجاج مقرمش", img: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200", available: true }
];

// 1. واجهة الزبائن (الرابط الرئيسي)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${systemConfig.restaurantName}</title>
    <style>
        body { font-family: sans-serif; background: #f4f6f8; margin: 0; padding-bottom: 80px; }
        .page-wrapper { max-width: 500px; margin: auto; background: white; min-height: 100vh; }
        .header { height: 180px; background: url('${systemConfig.bgImage}'); background-size: cover; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; text-shadow: 2px 2px 4px black; }
        .meal-card { padding: 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
        .meal-img { width: 80px; height: 80px; border-radius: 10px; object-fit: cover; }
    </style>
</head>
<body>
    <div class="page-wrapper">
        <div class="header"><h1>${systemConfig.restaurantName}</h1></div>
        ${mealsData.filter(m => m.available).map(m => `
            <div class="meal-card">
                <img src="${m.img}" class="meal-img">
                <div>
                    <div style="font-weight:bold;">${m.name}</div>
                    <div style="color:var(--primary-color);">${m.price} دينار</div>
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `);
});

// 2. واجهة الإدارة (الرابط: /admin)
app.get('/admin', (req, res) => {
    res.send(`
        <html dir="rtl">
        <body>
            <h1>لوحة الإدارة - التحكم بالأصناف</h1>
            ${mealsData.map(m => `
                <div style="border:1px solid #ccc; padding:10px; margin:10px;">
                    ${m.name} - <strong>${m.available ? 'متاحة' : 'غير متاحة'}</strong>
                    <button onclick="toggle(${m.id}, ${!m.available})">تبديل الحالة</button>
                </div>
            `).join('')}
            <script>
                async function toggle(id, status) {
                    await fetch('/api/toggle-meal-status', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ mealId: id, available: status })
                    });
                    location.reload();
                }
            </script>
        </body>
        </html>
    `);
});

// API لتغيير الحالة
app.post('/api/toggle-meal-status', (req, res) => {
    const { mealId, available } = req.body;
    const meal = mealsData.find(m => m.id === parseInt(mealId));
    if (meal) { meal.available = available; res.json({ success: true }); }
});

app.listen(port, () => console.log('السيرفر يعمل الآن!'));
