const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// بيانات المطعم
let menu = {
    name: "مطعم أبو يونس",
    items: [
        { id: 1, name: "شاورما دجاج", price: 3.5, available: true },
        { id: 2, name: "بروستد", price: 6.0, available: true }
    ],
    orders: []
};

// 1. رابط الزبائن (للمنيو)
app.get('/api/menu', (req, res) => res.json(menu));

// 2. رابط الطلبات (الزبون يطلب منه)
app.post('/api/order', (req, res) => {
    menu.orders.push(req.body);
    res.json({ message: "تم استلام طلبك بنجاح!" });
});

// 3. لوحة تحكم بسيطة (صاحب المطعم بشوف الطلبات)
app.get('/api/admin/orders', (req, res) => res.json(menu.orders));

app.listen(3000, () => console.log('Restaurant Server Ready'));
