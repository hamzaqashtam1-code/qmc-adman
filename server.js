const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- قواعد البيانات المؤقتة والإعدادات ---
let systemConfig = {
    restaurantName: "مطعم فلك",
    coverImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800", // سيتم تغييره بصورة من المعرض
    receiptWidth: "80mm",
    receiptFontSize: "14px"
};

let categories = ["شاورما", "بروستد", "مشروبات"];
let mealsData = [];
let ordersList = [];
let espState = { triggerBlueLed: false }; // حالة الـ ESP32

// --- 1. واجهة الإدارة (نظام المجلدات/التبويبات) ---
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>إدارة مطعم فلك</title>
    <style>
        /* ستايل زر الكهرباء (Toggle) */
        .toggle-checkbox:checked { right: 0; border-color: #22c55e; }
        .toggle-checkbox:checked + .toggle-label { background-color: #22c55e; }
        .toggle-checkbox { right: 0; z-index: 1; border-color: #e5e7eb; transition: all 0.3s; }
        .toggle-label { width: 3rem; height: 1.5rem; background-color: #e5e7eb; border-radius: 9999px; transition: all 0.3s; }
        
        /* طباعة الفاتورة */
        @media print {
            body * { visibility: hidden; }
            #printArea, #printArea * { visibility: visible; }
            #printArea { position: absolute; left: 0; top: 0; width: ${systemConfig.receiptWidth}; font-size: ${systemConfig.receiptFontSize}; }
        }
    </style>
</head>
<body class="bg-gray-100 font-sans">

    <!-- قائمة التبويبات العلوية -->
    <nav class="bg-gray-900 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center overflow-x-auto whitespace-nowrap">
        <div class="flex gap-4">
            <button onclick="openTab('ordersTab')" class="px-4 py-2 bg-green-700 rounded-lg font-bold">الطلبات الحية 🔔</button>
            <button onclick="openTab('itemsTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">إدارة الأصناف 🍔</button>
            <button onclick="openTab('ledgerTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">الجرد المالي 💰</button>
            <button onclick="openTab('settingsTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">الإعدادات ⚙️</button>
        </div>
        <button onclick="toggleViewMode()" class="bg-blue-600 px-3 py-1 rounded text-sm hidden md:block">تبديل حجم العرض (موبايل/ويب)</button>
    </nav>

    <div id="adminContainer" class="p-4 mx-auto transition-all duration-300 w-full max-w-7xl">
        
        <!-- التبويب 1: الطلبات الحية -->
        <div id="ordersTab" class="tab-content space-y-4">
            <h2 class="text-2xl font-bold">الطلبات الواردة (تنبيه للـ ESP32)</h2>
            <div id="liveOrdersList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- سيتم ملؤها عبر الـ JS -->
            </div>
        </div>

        <!-- التبويب 2: إدارة الأصناف -->
        <div id="itemsTab" class="tab-content hidden space-y-6">
            <div class="bg-white p-6 rounded-xl shadow">
                <h2 class="text-xl font-bold mb-4" id="formTitle">إضافة صنف جديد</h2>
                <form id="itemForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="hidden" id="editItemId">
                    <input type="text" id="itemName" placeholder="اسم الصنف" class="border p-3 rounded" required>
                    <input type="number" step="0.01" id="itemPrice" placeholder="السعر" class="border p-3 rounded" required>
                    
                    <div class="flex gap-2">
                        <select id="itemCategory" class="border p-3 rounded flex-1">
                            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                        <button type="button" onclick="addCategory()" class="bg-gray-200 px-4 rounded">+</button>
                    </div>

                    <div class="border p-3 rounded flex items-center justify-between">
                        <span class="text-sm text-gray-500">صورة الصنف (اختياري)</span>
                        <input type="file" id="itemImageFile" accept="image/*" class="text-sm">
                    </div>
                    
                    <button type="submit" class="bg-green-700 text-white p-3 rounded font-bold md:col-span-2">حفظ الصنف</button>
                </form>
            </div>

            <div class="bg-white p-6 rounded-xl shadow">
                <h2 class="text-xl font-bold mb-4">الأصناف الحالية</h2>
                <div class="space-y-3" id="adminItemsList"></div>
            </div>
        </div>

        <!-- التبويب 3: الجرد (الفوري + التاريخ) -->
        <div id="ledgerTab" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-6 rounded shadow text-center">
                    <h3 class="font-bold text-gray-500">الجرد الفوري (اليوم)</h3>
                    <p class="text-3xl font-black text-green-700 mt-2" id="todayLedger">0.00</p>
                </div>
                <div class="bg-white p-6 rounded shadow text-center">
                    <h3 class="font-bold text-gray-500">إجمالي الطلبات</h3>
                    <p class="text-3xl font-black text-blue-700 mt-2" id="totalOrdersCount">0</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded shadow">
                <h3 class="font-bold mb-4">البحث في الجرد (من - إلى)</h3>
                <div class="flex gap-4 mb-4">
                    <input type="datetime-local" id="dateFrom" class="border p-2 rounded flex-1">
                    <input type="datetime-local" id="dateTo" class="border p-2 rounded flex-1">
                    <button onclick="filterLedger()" class="bg-gray-800 text-white px-6 rounded">بحث</button>
                </div>
                <div id="filteredLedgerResult" class="text-xl font-bold text-center p-4 bg-gray-50 rounded hidden"></div>
            </div>
        </div>

        <!-- التبويب 4: الإعدادات (الغلاف والفاتورة) -->
        <div id="settingsTab" class="tab-content hidden space-y-6">
            <div class="bg-white p-6 rounded shadow space-y-4">
                <h2 class="text-xl font-bold">إعدادات المتجر والفاتورة</h2>
                <div>
                    <label class="block font-bold mb-2">تغيير غلاف المطعم (من المعرض):</label>
                    <input type="file" id="coverUpload" accept="image/*" class="border p-2 w-full rounded">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold mb-2">عرض الفاتورة (مثال: 80mm):</label>
                        <input type="text" id="recWidth" value="${systemConfig.receiptWidth}" class="border p-2 w-full rounded">
                    </div>
                    <div>
                        <label class="block font-bold mb-2">حجم خط الفاتورة (مثال: 14px):</label>
                        <input type="text" id="recFont" value="${systemConfig.receiptFontSize}" class="border p-2 w-full rounded">
                    </div>
                </div>
                <button onclick="saveSettings()" class="bg-green-700 text-white p-3 rounded font-bold w-full">تحديث الإعدادات</button>
            </div>
        </div>

    </div>

    <!-- منطقة مخفية لطباعة الفاتورة -->
    <div id="printArea" class="hidden bg-white p-4 text-center border-b border-dashed border-gray-400 font-bold">
        <h2 class="text-2xl mb-2">${systemConfig.restaurantName}</h2>
        <p class="text-sm mb-4">فاتورة طلب</p>
        <div id="printContent" class="text-right text-sm space-y-2 mb-4 border-t border-b border-dashed py-2"></div>
        <p class="text-lg">الإجمالي: <span id="printTotal"></span> دينار</p>
        <p class="text-xs mt-4">شكراً لزيارتكم</p>
    </div>

    <script>
        let mealsData = [];
        let ordersList = [];
        let isMobileView = false;

        // التبديل بين التبويبات
        function openTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');
        }

        // التبديل بين حجم التلفون وحجم الويب
        function toggleViewMode() {
            const container = document.getElementById('adminContainer');
            isMobileView = !isMobileView;
            if(isMobileView) {
                container.classList.remove('max-w-7xl');
                container.classList.add('max-w-md'); // حجم تلفون
            } else {
                container.classList.remove('max-w-md');
                container.classList.add('max-w-7xl'); // حجم ويب
            }
        }

        // تحويل الصورة إلى Base64
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        // جلب البيانات الأساسية
        async function loadAdminData() {
            const res = await fetch('/api/data');
            const data = await res.json();
            mealsData = data.meals;
            ordersList = data.orders;
            renderAdminItems();
            renderLiveOrders();
            calcLedger();
        }

        function renderAdminItems() {
            const container = document.getElementById('adminItemsList');
            container.innerHTML = mealsData.map(m => \`
                <div class="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg bg-gray-50 gap-4">
                    <div class="flex gap-3 items-center w-full md:w-auto">
                        \${m.img ? \`<img src="\${m.img}" class="w-16 h-16 rounded object-cover">\` : ''}
                        <div>
                            <h4 class="font-bold">\${m.name} (\${m.category})</h4>
                            <p class="text-green-700 font-bold">\${m.price} دينار</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 w-full md:w-auto justify-end">
                        <!-- زر سويتش الكهرباء -->
                        <div class="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id="toggle-\${m.id}" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" \${m.available ? 'checked' : ''} onchange="toggleAvail(\${m.id}, this.checked)"/>
                            <label for="toggle-\${m.id}" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                        <button onclick="editItem(\${m.id})" class="bg-blue-500 text-white px-3 py-1 rounded">تعديل</button>
                        <button onclick="deleteItem(\${m.id})" class="bg-red-500 text-white px-3 py-1 rounded">حذف</button>
                    </div>
                </div>
            \`).join('');
        }

        // الحفظ (إضافة أو تعديل)
        document.getElementById('itemForm').onsubmit = async (e) => {
            e.preventDefault();
            let imgBase64 = null;
            const fileInput = document.getElementById('itemImageFile');
            if(fileInput.files.length > 0) {
                imgBase64 = await fileToBase64(fileInput.files[0]);
            }

            const payload = {
                id: document.getElementById('editItemId').value || Date.now(),
                name: document.getElementById('itemName').value,
                price: document.getElementById('itemPrice').value,
                category: document.getElementById('itemCategory').value,
                img: imgBase64
            };

            await fetch('/api/save-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            document.getElementById('itemForm').reset();
            document.getElementById('editItemId').value = "";
            document.getElementById('formTitle').innerText = "إضافة صنف جديد";
            loadAdminData();
        };

        function editItem(id) {
            const m = mealsData.find(x => x.id == id);
            if(!m) return;
            document.getElementById('editItemId').value = m.id;
            document.getElementById('itemName').value = m.name;
            document.getElementById('itemPrice').value = m.price;
            document.getElementById('itemCategory').value = m.category;
            document.getElementById('formTitle').innerText = "تعديل الصنف: " + m.name;
            openTab('itemsTab');
            window.scrollTo(0,0);
        }

        async function deleteItem(id) {
            if(confirm('هل أنت متأكد من الحذف نهائياً؟')) {
                await fetch('/api/delete-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) });
                loadAdminData();
            }
        }

        async function toggleAvail(id, status) {
            await fetch('/api/toggle-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, status}) });
            loadAdminData();
        }

        async function addCategory() {
            const cat = prompt("أدخل اسم المجموعة الجديدة:");
            if(cat) {
                await fetch('/api/add-category', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cat}) });
                location.reload();
            }
        }

        // الجرد
        function calcLedger() {
            const total = ordersList.reduce((sum, o) => sum + parseFloat(o.total), 0);
            document.getElementById('todayLedger').innerText = total.toFixed(2) + " د.أ";
            document.getElementById('totalOrdersCount').innerText = ordersList.length;
        }

        function filterLedger() {
            const from = new Date(document.getElementById('dateFrom').value).getTime();
            const to = new Date(document.getElementById('dateTo').value).getTime();
            if(!from || !to) return alert('حدد التاريخ من وإلى');
            
            const filtered = ordersList.filter(o => o.timestamp >= from && o.timestamp <= to);
            const sum = filtered.reduce((s, o) => s + parseFloat(o.total), 0);
            
            const resDiv = document.getElementById('filteredLedgerResult');
            resDiv.innerHTML = \`مجموع المبيعات للفترة المحددة: <span class="text-green-700">\${sum.toFixed(2)} دينار</span> (\${filtered.length} طلب)\`;
            resDiv.classList.remove('hidden');
        }

        // الطلبات الحية والطباعة
        function renderLiveOrders() {
            const container = document.getElementById('liveOrdersList');
            container.innerHTML = ordersList.slice().reverse().map(o => \`
                <div class="bg-white p-4 border rounded shadow-sm border-l-4 border-l-green-600">
                    <div class="flex justify-between items-center mb-2">
                        <span class="bg-gray-800 text-white px-2 py-1 rounded text-sm">طاولة \${o.table}</span>
                        <span class="text-xs text-gray-400">\${new Date(o.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                    <p class="font-bold text-gray-800">\${o.summary}</p>
                    \${o.notes ? \`<p class="text-xs text-red-500 mt-1">ملاحظة: \${o.notes}</p>\` : ''}
                    <div class="mt-4 flex justify-between items-center border-t pt-2">
                        <span class="font-bold text-green-700">\${o.total} د.أ</span>
                        <button onclick='printReceipt(\${JSON.stringify(o)})' class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">طباعة الفاتورة 🖨️</button>
                    </div>
                </div>
            \`).join('');
        }

        function printReceipt(order) {
            const printContent = document.getElementById('printContent');
            printContent.innerHTML = order.summary.split(',').map(item => \`<div class="flex justify-between"><span>\${item}</span></div>\`).join('');
            if(order.notes) printContent.innerHTML += \`<div class="mt-2 pt-2 border-t text-xs">ملاحظة: \${order.notes}</div>\`;
            document.getElementById('printTotal').innerText = order.total;
            
            window.print();
        }

        async function saveSettings() {
            let coverBase64 = null;
            const fileInput = document.getElementById('coverUpload');
            if(fileInput.files.length > 0) {
                coverBase64 = await fileToBase64(fileInput.files[0]);
            }
            const payload = {
                receiptWidth: document.getElementById('recWidth').value,
                receiptFontSize: document.getElementById('recFont').value
            };
            if(coverBase64) payload.coverImage = coverBase64;

            await fetch('/api/update-settings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            alert('تم التحديث بنجاح!');
            location.reload();
        }

        loadAdminData();
        setInterval(loadAdminData, 10000); // تحديث تلقائي كل 10 ثواني للطلبات
    </script>
</body>
</html>
    `);
});


// --- 2. واجهة الزبون (التطبيق متجاوب والمتاح/غير متاح) ---
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
<body class="bg-gray-50 font-sans pb-24">

    <!-- مودال التنبيه الأنيق (السلة فارغة أو نجاح) -->
    <div id="alertModal" class="fixed inset-0 bg-black/60 z-50 hidden justify-center items-center p-4">
        <div class="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl">
            <div id="alertIcon" class="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4"></div>
            <h3 id="alertTitle" class="text-2xl font-bold mb-2 text-gray-800"></h3>
            <p id="alertMsg" class="text-sm text-gray-500 mb-4"></p>
            <button onclick="closeAlert()" id="alertBtn" class="w-full text-white p-3 rounded-xl font-bold"></button>
        </div>
    </div>

    <div class="max-w-md mx-auto bg-white min-h-screen shadow-lg relative">
        <!-- الغلاف المخصص من الإدارة -->
        <div class="h-48 bg-cover bg-center flex items-end p-4 relative" style="background-image: linear-gradient(to top, rgba(0,0,0,0.6), transparent), url('${systemConfig.coverImage}')">
            <h1 class="text-white text-3xl font-bold drop-shadow-md">${systemConfig.restaurantName}</h1>
        </div>

        <!-- فلاتر المجموعات -->
        <div class="flex gap-2 p-4 overflow-x-auto border-b sticky top-0 bg-white z-10" id="catsContainer"></div>

        <div id="menuContainer" class="p-4 space-y-4"></div>

        <!-- السلة -->
        <div onclick="openCart()" class="fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-gray-900 text-white p-4 rounded-2xl flex justify-between items-center shadow-xl cursor-pointer">
            <div class="flex items-center gap-2">
                <span id="cartBadge" class="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">0</span>
                <span class="font-bold">مراجعة السلة</span>
            </div>
            <span id="cartTotalBar" class="font-bold">0.00 دينار</span>
        </div>

        <!-- تفاصيل السلة -->
        <div id="cartModal" class="fixed inset-0 bg-black/50 z-40 hidden justify-center items-end">
            <div class="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b pb-2">
                    <h3 class="text-lg font-bold text-gray-800">سلة الطلبات</h3>
                    <button onclick="closeCart()" class="text-gray-400 font-bold text-xl">✕</button>
                </div>
                <div id="cartItemsList" class="space-y-2 text-sm"></div>
                <div>
                    <label class="block font-bold mb-1 text-sm">رقم الطاولة:</label>
                    <select id="tableNum" class="w-full p-3 border rounded-xl bg-gray-50 font-bold">
                        ${Array.from({length: 15}, (_, i) => `<option value="${i+1}">طاولة ${i+1}</option>`).join('')}
                    </select>
                </div>
                <textarea id="orderNotes" placeholder="ملاحظات (بدون بصل...)" class="w-full p-3 border rounded-xl text-sm"></textarea>
                <button onclick="submitOrder()" class="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-md">إرسال الطلب للمطبخ 🚀</button>
            </div>
        </div>
    </div>

    <script>
        let meals = [];
        let categories = [];
        let cart = {};
        let activeCat = "الكل";

        async function init() {
            const res = await fetch('/api/data');
            const data = await res.json();
            meals = data.meals;
            categories = ["الكل", ...data.categories];
            renderCats();
            renderMenu();
        }

        function showCustomAlert(type, title, msg) {
            const modal = document.getElementById('alertModal');
            const icon = document.getElementById('alertIcon');
            const btn = document.getElementById('alertBtn');
            
            if(type === 'empty') {
                icon.innerHTML = '🛒'; icon.className = "w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-gray-100";
                btn.className = "w-full p-3 rounded-xl font-bold bg-gray-800 text-white";
                btn.innerText = "تصفح المنيو";
            } else {
                icon.innerHTML = '✓'; icon.className = "w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 bg-green-100 text-green-600";
                btn.className = "w-full p-3 rounded-xl font-bold bg-green-600 text-white";
                btn.innerText = "ممتاز";
            }
            
            document.getElementById('alertTitle').innerText = title;
            document.getElementById('alertMsg').innerText = msg;
            modal.style.display = 'flex';
        }
        function closeAlert() { document.getElementById('alertModal').style.display = 'none'; }

        function renderCats() {
            document.getElementById('catsContainer').innerHTML = categories.map(c => 
                \`<button onclick="setCat('\${c}')" class="cat-btn px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition border \${c === activeCat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'}" data-cat="\${c}">\${c}</button>\`
            ).join('');
        }

        function setCat(c) {
            activeCat = c;
            document.querySelectorAll('.cat-btn').forEach(btn => {
                if(btn.dataset.cat === c) { btn.classList.add('bg-gray-900', 'text-white'); btn.classList.remove('bg-white', 'text-gray-600'); }
                else { btn.classList.remove('bg-gray-900', 'text-white'); btn.classList.add('bg-white', 'text-gray-600'); }
            });
            renderMenu();
        }

        function renderMenu() {
            const list = activeCat === "الكل" ? meals : meals.filter(m => m.category === activeCat);
            
            document.getElementById('menuContainer').innerHTML = list.map(m => \`
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-3 \${!m.available ? 'opacity-60 grayscale' : ''}">
                    \${m.img ? \`<img src="\${m.img}" class="w-24 h-24 rounded-xl object-cover">\` : \`<div class="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">بدون صورة</div>\`}
                    <div class="flex-1 flex flex-col justify-between py-1">
                        <div>
                            <h4 class="font-bold text-gray-800">\${m.name}</h4>
                            \${!m.available ? \`<span class="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded font-bold">غير متاح حالياً</span>\` : ''}
                        </div>
                        <div class="flex justify-between items-end">
                            <span class="font-black text-green-700">\${m.price} د.أ</span>
                            \${m.available ? \`
                                <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button onclick="updateCart(\${m.id}, -1)" class="w-8 h-8 rounded bg-white shadow-sm font-bold">-</button>
                                    <span id="qty-\${m.id}" class="font-bold w-4 text-center">\${cart[m.id] || 0}</span>
                                    <button onclick="updateCart(\${m.id}, 1)" class="w-8 h-8 rounded bg-gray-800 text-white shadow-sm font-bold">+</button>
                                </div>
                            \` : \`<button disabled class="bg-gray-200 text-gray-500 px-3 py-1 rounded-lg text-sm font-bold">نفذت الكمية</button>\`}
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        function updateCart(id, change) {
            cart[id] = Math.max(0, (cart[id] || 0) + change);
            if(cart[id] === 0) delete cart[id];
            document.getElementById('qty-'+id).innerText = cart[id] || 0;
            calcCart();
        }

        function calcCart() {
            let total = 0, count = 0;
            for(let id in cart) {
                let m = meals.find(x => x.id == id);
                if(m) { count += cart[id]; total += m.price * cart[id]; }
            }
            document.getElementById('cartBadge').innerText = count;
            document.getElementById('cartTotalBar').innerText = total.toFixed(2) + " دينار";
            return total;
        }

        function openCart() {
            if(Object.keys(cart).length === 0) {
                showCustomAlert('empty', 'سلتك فارغة!', 'يرجى اختيار بعض الأطباق الشهية من القائمة أولاً.');
                return;
            }
            const list = document.getElementById('cartItemsList');
            list.innerHTML = Object.keys(cart).map(id => {
                let m = meals.find(x => x.id == id);
                return \`<div class="flex justify-between border-b pb-2"><span>\${m.name} <b class="text-green-600">x\${cart[id]}</b></span><b>\${(m.price*cart[id]).toFixed(2)} د.أ</b></div>\`;
            }).join('');
            document.getElementById('cartModal').style.display = 'flex';
        }

        function closeCart() { document.getElementById('cartModal').style.display = 'none'; }

        async function submitOrder() {
            const summary = Object.keys(cart).map(id => {
                let m = meals.find(x => x.id == id);
                return \`\${m.name} (\${cart[id]})\`;
            }).join(' ، ');

            const payload = {
                table: document.getElementById('tableNum').value,
                notes: document.getElementById('orderNotes').value,
                summary: summary,
                total: calcCart().toFixed(2)
            };

            await fetch('/api/submit-order', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            
            closeCart();
            cart = {};
            calcCart();
            renderMenu();
            showCustomAlert('success', 'طلبك في المطبخ!', 'تم استلام طلبك بنجاح وسيتم تحضيره فوراً للطاولة رقم ' + payload.table);
        }

        init();
    </script>
</body>
</html>
    `);
});


// --- 3. مسارات الـ API الخلفية للتحكم بالبيانات ---

app.get('/api/data', (req, res) => {
    res.json({ meals: mealsData, categories: categories, orders: ordersList });
});

app.post('/api/save-item', (req, res) => {
    const { id, name, price, category, img } = req.body;
    let existing = mealsData.find(m => m.id == id);
    if(existing) {
        existing.name = name; existing.price = parseFloat(price); existing.category = category;
        if(img) existing.img = img;
    } else {
        mealsData.push({ id: id, name, price: parseFloat(price), category, img, available: true });
    }
    res.json({success: true});
});

app.post('/api/delete-item', (req, res) => {
    mealsData = mealsData.filter(m => m.id != req.body.id);
    res.json({success: true});
});

app.post('/api/toggle-item', (req, res) => {
    const item = mealsData.find(m => m.id == req.body.id);
    if(item) item.available = req.body.status;
    res.json({success: true});
});

app.post('/api/add-category', (req, res) => {
    if(!categories.includes(req.body.cat)) categories.push(req.body.cat);
    res.json({success: true});
});

app.post('/api/update-settings', (req, res) => {
    if(req.body.coverImage) systemConfig.coverImage = req.body.coverImage;
    if(req.body.receiptWidth) systemConfig.receiptWidth = req.body.receiptWidth;
    if(req.body.receiptFontSize) systemConfig.receiptFontSize = req.body.receiptFontSize;
    res.json({success: true});
});

app.post('/api/submit-order', (req, res) => {
    ordersList.push({ ...req.body, timestamp: Date.now() });
    espState.triggerBlueLed = true; // تفعيل إشارة הـ ESP32
    res.json({success: true});
});

// --- 4. نقطة اتصال (Endpoint) خاصة للـ ESP32 NRF24L01 ---
// قم ببرمجة لوحة الـ ESP32 لتقوم بعمل HTTP GET Request لهذا الرابط كل ثانيتين
app.get('/api/esp-status', (req, res) => {
    if(espState.triggerBlueLed) {
        espState.triggerBlueLed = false; // إعادة الضبط بعد القراءة
        res.send("ON"); // الميكروكنترولر سيقرأ ON ويضيء الـ LED الأزرق
    } else {
        res.send("OFF");
    }
});

app.listen(port, () => console.log(`Super System Running on port ${port}`));
