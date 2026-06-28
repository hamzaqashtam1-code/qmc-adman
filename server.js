const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// إعدادات الأمان والدخول
let adminCredentials = {
    username: "admin",
    password: "123456" // كلمة السر الافتراضية
};
const MASTER_PASSWORD = "YounisQMC2026"; // كلمة السر الخاصة (الماستر) للطوارئ

// الإعدادات الافتراضية للمطعم
let systemConfig = {
    restaurantName: "مطاعم أبو يونس",
    bgImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    themeColor: "#1e4620"
};

let categories = ["الكل", "شاورما", "بروستد", "مشروبات"];

let mealsData = [
    { id: 1, name: "شاورما دجاج", price: 3.50, category: "شاورما", description: "شاورما على الفحم مع الثومية والبطاطس المقرمشة", img: "https://images.unsplash.com/photo-1649144368140-5e3692beeb51?w=200", available: true },
    { id: 2, name: "بروستد كامل", price: 6.00, category: "بروستد", description: "4 قطع دجاج بروستد مقرمش مع البطاطا والثومية", img: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200", available: true },
    { id: 3, name: "بيبسي", price: 0.50, category: "مشروبات", description: "عبوة باردة ومنعشة", img: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200", available: true }
];

let ordersList = [];

// --- 1. واجهة الإدارة الاحترافية مع الحماية ---
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>لوحة الإدارة - مطاعم أبو يونس</title>
</head>
<body class="bg-gray-100 font-sans">

    <div id="loginOverlay" class="fixed inset-0 bg-gray-900 flex justify-center items-center p-4 z-50">
        <div class="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center space-y-4">
            <h2 class="text-2xl font-bold text-gray-800">تسجيل دخول الإدارة 🔒</h2>
            <p class="text-sm text-gray-400">الرجاء إدخال بيانات الحساب للمتابعة</p>
            <div class="space-y-3 text-right">
                <label class="text-xs font-bold text-gray-600 block">اسم المستخدم:</label>
                <input type="text" id="loginUser" class="w-full p-3 border rounded-xl" placeholder="Username">
                <label class="text-xs font-bold text-gray-600 block">كلمة المرور:</label>
                <input type="password" id="loginPass" class="w-full p-3 border rounded-xl" placeholder="••••••">
            </div>
            <p id="loginError" class="text-red-500 text-xs hidden">البيانات المدخلة غير صحيحة!</p>
            <button onclick="checkLogin()" class="w-full bg-green-700 text-white p-3 rounded-xl font-bold hover:bg-green-800 transition">دخول اللوحة 🚀</button>
        </div>
    </div>

    <div id="adminContent" class="max-w-4xl mx-auto space-y-6 p-4 md:p-8 hidden">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 gap-4">
            <h1 class="text-3xl font-bold text-gray-800">لوحة الإدارة والتحكم العالمية 🛠️</h1>
            <button onclick="logout()" class="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold">تسجيل خروج 🚪</button>
        </div>
        
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 class="text-xl font-bold text-gray-700 mb-4">تعديل بيانات الحساب والأمان 🔑</h2>
            <form id="changePassForm" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" id="newUsername" placeholder="اسم المستخدم الجديد" class="p-3 border rounded-xl" required>
                <input type="password" id="newPassword" placeholder="كلمة المرور الجديدة" class="p-3 border rounded-xl" required>
                <button type="submit" class="bg-gray-800 text-white p-3 rounded-xl font-bold hover:bg-gray-900 transition">تحديث الأمان</button>
            </form>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 class="text-xl font-bold text-gray-700 mb-4">إضافة صنف جديد للمنيو</h2>
            <form id="addMealForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="mealName" placeholder="اسم الوجبة" class="p-3 border rounded-xl" required>
                <input type="number" step="0.01" id="mealPrice" placeholder="السعر (دينار)" class="p-3 border rounded-xl" required>
                <select id="mealCategory" class="p-3 border rounded-xl">
                    ${categories.filter(c => c !== "الكل").map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <input type="text" id="mealImg" placeholder="رابط صورة الوجبة" class="p-3 border rounded-xl" value="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200">
                <textarea id="mealDesc" placeholder="وصف الوجبة الشامل..." class="p-3 border rounded-xl md:col-span-2"></textarea>
                <button type="submit" class="md:col-span-2 bg-green-700 text-white p-3 rounded-xl font-bold hover:bg-green-800 transition">إضافة الصنف فوراً 🚀</button>
            </form>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 class="text-xl font-bold text-gray-700 mb-4">التحكم بالأصناف وحالة التوفر حركياً</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${mealsData.map(m => `
                    <div class="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                        <div class="flex items-center gap-3">
                            <img src="${m.img}" class="w-12 h-12 rounded-lg object-cover">
                            <div>
                                <h3 class="font-bold text-gray-800">${m.name}</h3>
                                <p class="text-sm text-green-700 font-semibold">${m.price.toFixed(2)} دينار [${m.category}]</p>
                            </div>
                        </div>
                        <button onclick="toggleStatus(${m.id}, ${!m.available})" class="px-4 py-2 rounded-xl text-white font-bold text-sm transition ${m.available ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}">
                            ${m.available ? 'متاح ✅' : 'مخفي ❌'}
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        // فحص حالة الجلسة عند التحميل تلقائياً
        if(localStorage.getItem('isAdminLoggedIn') === 'true') {
            showAdminPanel();
        }

        async function checkLogin() {
            const user = document.getElementById('loginUser').value;
            const pass = document.getElementById('loginPass').value;
            
            const res = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });
            const data = await res.json();
            
            if(data.success) {
                localStorage.setItem('isAdminLoggedIn', 'true');
                showAdminPanel();
            } else {
                document.getElementById('loginError').classList.remove('hidden');
            }
        }

        function showAdminPanel() {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
        }

        function logout() {
            localStorage.removeItem('isAdminLoggedIn');
            location.reload();
        }

        document.getElementById('changePassForm').onsubmit = async (e) => {
            e.preventDefault();
            const user = document.getElementById('newUsername').value;
            const pass = document.getElementById('newPassword').value;
            
            const res = await fetch('/api/admin-update-creds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });
            const data = await res.json();
            if(data.success) {
                alert("تم تحديث بيانات الأمان بنجاح!");
                logout();
            }
        };

        async function toggleStatus(id, currentStatus) {
            await fetch('/api/toggle-meal-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mealId: id, available: currentStatus })
            });
            location.reload();
        }

        document.getElementById('addMealForm').onsubmit = async (e) => {
            e.preventDefault();
            const newMeal = {
                name: document.getElementById('mealName').value,
                price: parseFloat(document.getElementById('mealPrice').value),
                category: document.getElementById('mealCategory').value,
                img: document.getElementById('mealImg').value,
                description: document.getElementById('mealDesc').value
            };
            
            await fetch('/api/add-new-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMeal)
            });
            location.reload();
        };
    </script>
</body>
</html>
    `);
});

// --- 2. واجهة الزبائن الكاملة (تطبيق عالمي) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>${systemConfig.restaurantName}</title>
</head>
<body class="bg-gray-100 font-sans pb-24">

    <div id="successModal" class="fixed inset-0 bg-black/60 z-50 hidden justify-center items-center p-4">
        <div class="bg-green-800 text-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl scale-95 transition-all">
            <div class="w-16 h-16 bg-white text-green-800 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">✓</div>
            <h3 class="text-2xl font-bold mb-2">تم الطلب بنجاح</h3>
            <p id="successDetails" class="text-sm opacity-90 mb-4"></p>
            <button onclick="closeSuccess()" class="w-full bg-white text-green-800 p-3 rounded-xl font-bold">رائع ✨</button>
        </div>
    </div>

    <div class="max-w-md mx-auto bg-white min-h-screen shadow-lg relative">
        <div class="h-44 bg-cover bg-center flex items-end p-4 relative" style="background-image: linear-gradient(to top, rgba(0,0,0,0.7), transparent), url('${systemConfig.bgImage}')">
            <h1 class="text-white text-2xl font-bold">${systemConfig.restaurantName}</h1>
        </div>

        <div class="flex gap-2 p-4 overflow-x-auto border-b sticky top-0 bg-white z-10">
            ${categories.map(c => `<button onclick="filterCat('${c}', this)" class="cat-btn px-4 py-2 rounded-full border border-green-700 text-green-700 font-bold whitespace-nowrap text-sm transition ${c === 'الكل' ? 'bg-green-700 text-white' : ''}">${c}</button>`).join('')}
        </div>

        <div id="menuContainer" class="p-4 space-y-4"></div>

        <div onclick="openCart()" class="fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-green-800 text-white p-4 rounded-2xl flex justify-between items-center shadow-xl cursor-pointer hover:bg-green-900 transition">
            <div class="flex items-center gap-2">
                <span id="cartBadge" class="bg-white text-green-800 text-xs px-2 py-1 rounded-full font-bold">0</span>
                <span class="font-bold">عرض السلة 🛒</span>
            </div>
            <span id="cartTotalBar" class="font-bold">0.00 دينار</span>
        </div>

        <div id="cartModal" class="fixed inset-0 bg-black/50 z-40 hidden justify-center items-end">
            <div class="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b pb-2">
                    <h3 class="text-lg font-bold text-gray-800">سلة الطلبات مراجعة</h3>
                    <button onclick="closeCart()" class="text-gray-400 text-xl font-bold">✕</button>
                </div>
                <div id="cartItemsList" class="space-y-2 text-sm text-gray-600"></div>
                
                <div>
                    <label class="block font-bold mb-1 text-gray-700 text-sm">حدد رقم الطاولة:</label>
                    <select id="tableNum" class="w-full p-3 border rounded-xl bg-gray-50 font-bold text-gray-700">
                        ${Array.from({length: 12}, (_, i) => `<option value="${i+1}">طاولة رقم ${i+1}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <textarea id="orderNotes" placeholder="أي ملاحظات خاصة؟ (مثال: بدون بصل، زيادة كاتشب...)" class="w-full p-3 border rounded-xl text-sm"></textarea>
                </div>

                <div class="flex justify-between font-bold text-lg border-t pt-3">
                    <span>الإجمالي النهائي:</span>
                    <span id="modalTotal" class="text-green-700">0.00 دينار</span>
                </div>

                <button onclick="sendOrderToServer()" class="w-full bg-green-700 text-white p-4 rounded-xl font-bold text-base shadow-md">تأكيد وإرسال الطلب للمطبخ 📲</button>
            </div>
        </div>
    </div>

    <script>
        const fullMeals = ${JSON.stringify(mealsData)}.filter(m => m.available);
        let cart = {};
        let activeCat = "الكل";

        function filterCat(cat, btn) {
            activeCat = cat;
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('bg-green-700', 'text-white'));
            btn.classList.add('bg-green-700', 'text-white');
            renderMenu();
        }

        function renderMenu() {
            const container = document.getElementById('menuContainer');
            const list = activeCat === "الكل" ? fullMeals : fullMeals.filter(m => m.category === activeCat);
            
            if(list.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 py-6">لا توجد أصناف في هذا القسم حالياً.</p>';
                return;
            }

            container.innerHTML = list.map(m => \`
                <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
                    <img src="\${m.img}" class="w-20 h-20 rounded-xl object-cover flex-shrink-0">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-gray-800 text-base truncate">\${m.name}</h4>
                        <p class="text-xs text-gray-400 line-clamp-2 mt-0.5">\${m.description || ''}</p>
                        <p class="text-sm font-bold text-green-700 mt-1">\${m.price.toFixed(2)} دينار</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="updateCartQty(\${m.id}, -1)" class="w-8 h-8 bg-gray-100 font-bold rounded-full text-gray-700">-</button>
                        <span id="qty-\${m.id}" class="font-bold text-sm w-4 text-center">\${cart[m.id] || 0}</span>
                        <button onclick="updateCartQty(\${m.id}, 1)" class="w-8 h-8 bg-green-700 font-bold rounded-full text-white">+</button>
                    </div>
                </div>
            \`).join('');
        }

        function updateCartQty(id, change) {
            cart[id] = (cart[id] || 0) + change;
            if(cart[id] <= 0) delete cart[id];
            document.getElementById('qty-'+id) ? document.getElementById('qty-'+id).innerText = (cart[id] || 0) : null;
            calcTotals();
        }

        function calcTotals() {
            let count = 0, total = 0;
            for(let id in cart) {
                let m = fullMeals.find(x => x.id == id);
                if(m) { count += cart[id]; total += m.price * cart[id]; }
            }
            document.getElementById('cartBadge').innerText = count;
            document.getElementById('cartTotalBar').innerText = total.toFixed(2) + " دينار";
            document.getElementById('modalTotal').innerText = total.toFixed(2) + " دينار";
        }

        function openCart() {
            if(Object.keys(cart).length === 0) { alert("السلة فارغة حالياً!"); return; }
            document.getElementById('cartModal').style.display = 'flex';
            const list = document.getElementById('cartItemsList');
            list.innerHTML = "";
            for(let id in cart) {
                let m = fullMeals.find(x => x.id == id);
                if(m) {
                    list.innerHTML += \`<div class="flex justify-between border-b pb-1"><span>• \${m.name} (x\${cart[id]})</span><span class="font-bold">\${(m.price*cart[id]).toFixed(2)} دينار</span></div>\`;
                }
            }
        }
        function closeCart() { document.getElementById('cartModal').style.display = 'none'; }

        function sendOrderToServer() {
            const table = document.getElementById('tableNum').value;
            const notes = document.getElementById('orderNotes').value;
            
            fetch('/api/submit-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table, notes, cart })
            }).then(() => {
                closeCart();
                document.getElementById('successDetails').innerText = "تم توجيه طلبك للطاولة رقم (" + table + ") بنجاح.";
                document.getElementById('successModal').style.display = 'flex';
                cart = {};
                calcTotals();
                renderMenu();
            });
        }
        function closeSuccess() { document.getElementById('successModal').style.display = 'none'; }

        renderMenu();
    </script>
</body>
</html>
    `);
});

// --- 3. الـ APIs الأمنية والتحكم في الخلفية ---
app.post('/api/admin-login', (req, res) => {
    const { user, pass } = req.body;
    // فحص إذا استخدم الحساب الحالي أو كلمة السر الماستر للطوارئ
    if ((user === adminCredentials.username && pass === adminCredentials.password) || pass === MASTER_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/admin-update-creds', (req, res) => {
    const { user, pass } = req.body;
    adminCredentials.username = user;
    adminCredentials.password = pass;
    res.json({ success: true });
});

app.post('/api/toggle-meal-status', (req, res) => {
    const { mealId, available } = req.body;
    const meal = mealsData.find(m => m.id === parseInt(mealId));
    if (meal) { meal.available = available; res.json({ success: true }); }
    else { res.status(404).json({ success: false }); }
});

app.post('/api/add-new-meal', (req, res) => {
    const { name, price, category, img, description } = req.body;
    mealsData.push({ id: Date.now(), name, price: parseFloat(price), category, img, description, available: true });
    res.json({ success: true });
});

app.post('/api/submit-order', (req, res) => {
    ordersList.push({ id: Date.now(), ...req.body });
    res.json({ success: true });
});

app.listen(port, () => console.log(`Secure Server running on port ${port}`));
