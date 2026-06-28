const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// البيانات الأساسية
let mealsData = [
    { id: 1, name: "شاورما دجاج", price: 3.5, category: "شاورما", img: "https://shorturl.at/xT012", available: true },
    { id: 2, name: "بروستد", price: 6.0, category: "بروستد", img: "https://shorturl.at/pGMN1", available: true }
];

// --- واجهة الإدارة (Dashboard) ---
app.get('/admin', (req, res) => {
    res.send(`
    <script src="https://cdn.tailwindcss.com"></script>
    <div class="p-8 bg-gray-100 min-h-screen">
        <h1 class="text-3xl font-bold mb-6">لوحة الإدارة الاحترافية</h1>
        <div class="bg-white p-6 rounded-xl shadow mb-8">
            <h2 class="text-xl mb-4">إضافة صنف جديد</h2>
            <form id="addForm" class="flex gap-4">
                <input type="text" id="name" placeholder="اسم الوجبة" class="border p-2 rounded">
                <input type="number" id="price" placeholder="السعر" class="border p-2 rounded">
                <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">إضافة</button>
            </form>
        </div>
        <div class="grid gap-4">
            ${mealsData.map(m => `
                <div class="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                    <span>${m.name} - ${m.price} JD</span>
                    <button onclick="toggle(${m.id})" class="${m.available ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded">
                        ${m.available ? 'متاحة' : 'غير متاحة'}
                    </button>
                </div>
            `).join('')}
        </div>
    </div>
    <script>
        async function toggle(id) {
            await fetch('/api/toggle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) });
            location.reload();
        }
        document.getElementById('addForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const price = document.getElementById('price').value;
            await fetch('/api/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, price }) });
            location.reload();
        }
    </script>
    `);
});

// --- واجهة الزبون (Menu) ---
app.get('/', (req, res) => {
    res.send(`
    <script src="https://cdn.tailwindcss.com"></script>
    <div class="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
        <div class="bg-green-800 text-white p-6 text-center text-2xl font-bold">مطعم أبو يونس</div>
        <div id="menu" class="p-4 space-y-4">
            ${mealsData.filter(m => m.available).map(m => `
                <div class="bg-white p-4 rounded-2xl shadow flex justify-between items-center">
                    <div>
                        <h3 class="font-bold">${m.name}</h3>
                        <p class="text-green-700">${m.price} دينار</p>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="changeQty(${m.id}, -1)" class="bg-gray-200 px-3 py-1 rounded-lg">-</button>
                        <span id="qty-${m.id}">0</span>
                        <button onclick="changeQty(${m.id}, 1)" class="bg-green-600 text-white px-3 py-1 rounded-lg">+</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="fixed bottom-0 w-full max-w-md p-4 bg-white border-t">
            <button onclick="submit()" class="w-full bg-green-700 text-white py-3 rounded-xl font-bold">تأكيد الطلب</button>
        </div>
    </div>
    <script>
        let cart = {};
        function changeQty(id, val) {
            cart[id] = Math.max(0, (cart[id] || 0) + val);
            document.getElementById('qty-' + id).innerText = cart[id];
        }
        function submit() {
            alert('تم إرسال الطلب بنجاح للطاولة!');
        }
    </script>
    `);
});

// --- APIs ---
app.post('/api/toggle', (req, res) => {
    const meal = mealsData.find(m => m.id === req.body.id);
    if(meal) meal.available = !meal.available;
    res.json({success: true});
});

app.post('/api/add', (req, res) => {
    mealsData.push({ id: Date.now(), name: req.body.name, price: parseFloat(req.body.price), available: true });
    res.json({success: true});
});

app.listen(3000, () => console.log('Server running on 3000'));
