const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// البيانات المركزية التي سيقرأها موقع الزبائن وموقع الإدارة
let data = {
    systemConfig: { 
        restaurantName: "مطاعم أبو يونس", 
        bgImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5", 
        themeColor: "#1e4620", 
        availableTables: 12 
    },
    categories: [{name: "شاورما"}, {name: "بروستد"}, {name: "مشروبات"}],
    mealsData: [
        { id: 1, name: "شاورما دجاج", price: 3.50, category: "شاورما", img: "https://images.unsplash.com/photo-1649144368140-5e3692beeb51?w=200", available: true },
        { id: 2, name: "بروستد", price: 6.00, category: "بروستد", img: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200", available: true }
    ],
    ordersList: []
};

// هذا الرابط الذي سيطلبه موقع الزبائن ليأخذ البيانات (المنيو والإعدادات)
app.get('/api/public/menu', (req, res) => res.json(data));

// هنا يستقبل السيرفر الطلبات من موقع الزبائن ويحفظها في القائمة
app.post('/api/public/submit-order', (req, res) => {
    data.ordersList.unshift(req.body);
    res.json({ success: true });
});

// هذا الرابط لمشاهدة الطلبات (مستقبلاً)
app.get('/api/orders', (req, res) => res.json(data.ordersList));

app.listen(3000, () => console.log('Admin Server Running'));
