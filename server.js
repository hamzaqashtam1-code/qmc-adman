const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- إعدادات النظام الديناميكية ---
let systemConfig = {
    restaurantName: "مطعم فلك",
    coverImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
    themeColor: "#15803d", // اللون الأخضر الافتراضي
    tableCount: 15,
    thankYouMsg: "شكراً لزيارتكم! نتمنى لكم وجبة شهية وعودة قريبة.",
    receiptWidth: "80mm",
    receiptFontSize: "14px",
    adminUser: "admin",
    adminPass: "123456"
};

let categories = ["شاورما", "بروستد", "مشروبات"];
let mealsData = [];
let ordersList = [];
let printQueue = []; // طابور الطلبات الجاهزة للطباعة عبر ESP32

// --- 1. واجهة الإدارة ---
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>إدارة | ${systemConfig.restaurantName}</title>
    <style>
        :root { --theme: ${systemConfig.themeColor}; }
        .theme-bg { background-color: var(--theme); color: white; }
        .theme-text { color: var(--theme); }
        .theme-border { border-color: var(--theme); }
        
        .toggle-checkbox:checked { right: 0; border-color: var(--theme); }
        .toggle-checkbox:checked + .toggle-label { background-color: var(--theme); }
        .toggle-checkbox { right: 0; z-index: 1; border-color: #e5e7eb; transition: all 0.3s; }
        .toggle-label { width: 3rem; height: 1.5rem; background-color: #e5e7eb; border-radius: 9999px; transition: all 0.3s; }
        
        @media print {
            body * { visibility: hidden; }
            #printArea, #printArea * { visibility: visible; }
            #printArea { position: absolute; left: 0; top: 0; width: ${systemConfig.receiptWidth}; font-size: ${systemConfig.receiptFontSize}; }
        }
    </style>
</head>
<body class="bg-gray-100 font-sans">

    <nav class="bg-gray-900 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center overflow-x-auto whitespace-nowrap">
        <div class="flex gap-2 md:gap-4">
            <button onclick="openTab('ordersTab')" class="px-4 py-2 theme-bg rounded-lg font-bold">الطلبات الواردة 🔔</button>
            <button onclick="openTab('itemsTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">الأصناف 🍔</button>
            <button onclick="openTab('ledgerTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">كشف الجرد 💰</button>
            <button onclick="openTab('settingsTab')" class="px-4 py-2 hover:bg-gray-700 rounded-lg">الإعدادات ⚙️</button>
        </div>
    </nav>

    <div id="adminContainer" class="p-4 mx-auto transition-all w-full max-w-7xl">
        
        <div id="ordersTab" class="tab-content space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-bold">الطلبات الواردة</h2>
                <button onclick="clearOrders()" class="text-red-500 text-sm font-bold hover:underline">مسح كل الطلبات</button>
            </div>
            <div id="liveOrdersList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </div>

        <div id="itemsTab" class="tab-content hidden space-y-6">
            <div class="bg-white p-6 rounded-xl shadow">
                <h2 class="text-xl font-bold mb-4" id="formTitle">إضافة صنف جديد</h2>
                <form id="itemForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="hidden" id="editItemId">
                    <input type="text" id="itemName" placeholder="اسم الصنف" class="border p-3 rounded" required>
                    <input type="number" step="0.01" id="itemPrice" placeholder="السعر" class="border p-3 rounded" required>
                    <select id="itemCategory" class="border p-3 rounded md:col-span-2">
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <div class="border p-3 rounded flex items-center justify-between md:col-span-2">
                        <span class="text-sm text-gray-500">صورة الصنف</span>
                        <input type="file" id="itemImageFile" accept="image/*" class="text-sm">
                    </div>
                    <button type="submit" class="theme-bg p-3 rounded font-bold md:col-span-2">حفظ الصنف</button>
                </form>
            </div>
            <div class="bg-white p-6 rounded-xl shadow space-y-3" id="adminItemsList"></div>
        </div>

        <div id="ledgerTab" class="tab-content hidden space-y-6">
            <div class="bg-white p-6 rounded shadow flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 class="font-bold mb-2">تحديد فترة الكشف</h3>
                    <div class="flex gap-2">
                        <input type="date" id="dateFrom" class="border p-2 rounded">
                        <input type="date" id="dateTo" class="border p-2 rounded">
                        <button onclick="filterLedger()" class="bg-gray-800 text-white px-4 rounded">توليد الكشف</button>
                    </div>
                </div>
                <div class="text-left">
                    <p class="text-gray-500 font-bold text-sm">إجمالي مبيعات الكشف</p>
                    <p class="text-4xl font-black theme-text" id="ledgerTotalSum">0.00 د.أ</p>
                </div>
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-right">
                        <thead class="bg-gray-100 border-b">
                            <tr>
                                <th class="p-4 font-bold text-gray-600">الوقت والتاريخ</th>
                                <th class="p-4 font-bold text-gray-600">الطاولة</th>
                                <th class="p-4 font-bold text-gray-600">تفاصيل الطلب</th>
                                <th class="p-4 font-bold text-gray-600">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody id="ledgerTableBody" class="divide-y"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="settingsTab" class="tab-content hidden space-y-6">
            <div class="bg-white p-6 rounded shadow space-y-6">
                <h2 class="text-2xl font-bold border-b pb-2">الإعدادات العامة</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label class="block font-bold text-sm mb-1">اسم المطعم</label><input type="text" id="cfgName" value="${systemConfig.restaurantName}" class="w-full border p-2 rounded bg-gray-50"></div>
                    <div><label class="block font-bold text-sm mb-1">لون التطبيق الأساسي</label><input type="color" id="cfgColor" value="${systemConfig.themeColor}" class="w-full h-10 border rounded cursor-pointer"></div>
                    <div><label class="block font-bold text-sm mb-1">عدد الطاولات المتاحة</label><input type="number" id="cfgTables" value="${systemConfig.tableCount}" class="w-full border p-2 rounded bg-gray-50"></div>
                    <div><label class="block font-bold text-sm mb-1">غلاف المطعم (صورة)</label><input type="file" id="cfgCover" accept="image/*" class="w-full border p-1.5 rounded"></div>
                    <div class="md:col-span-2"><label class="block font-bold text-sm mb-1">رسالة الشكر للزبون</label><textarea id="cfgThanks" class="w-full border p-2 rounded bg-gray-50">${systemConfig.thankYouMsg}</textarea></div>
                </div>

                <h3 class="text-xl font-bold border-b pb-2 mt-8">إدارة أقسام المنيو (الفلاتر)</h3>
                <div class="flex gap-2">
                    <input type="text" id="newCatName" placeholder="اسم القسم الجديد" class="border p-2 rounded flex-1">
                    <button onclick="addCategory()" class="bg-gray-800 text-white px-4 rounded font-bold">إضافة</button>
                </div>
                <div id="catsAdminList" class="flex flex-wrap gap-2 mt-3">
                    ${categories.map(c => `
                        <div class="bg-gray-100 border px-3 py-1 rounded-full flex items-center gap-2">
                            <span class="font-bold text-sm">${c}</span>
                            <button onclick="deleteCategory('${c}')" class="text-red-500 hover:text-red-700 font-bold text-lg leading-none">&times;</button>
                        </div>
                    `).join('')}
                </div>

                <h3 class="text-xl font-bold border-b pb-2 mt-8">إعدادات الأمان</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label class="block font-bold text-sm mb-1">اسم المستخدم</label><input type="text" id="cfgUser" value="${systemConfig.adminUser}" class="w-full border p-2 rounded bg-gray-50"></div>
                    <div><label class="block font-bold text-sm mb-1">كلمة المرور</label><input type="text" id="cfgPass" value="${systemConfig.adminPass}" class="w-full border p-2 rounded bg-gray-50"></div>
                </div>

                <button onclick="saveAllSettings()" class="w-full theme-bg p-4 rounded-xl font-bold mt-4 shadow-md hover:opacity-90">حفظ الإعدادات بالكامل 💾</button>
            </div>
        </div>
    </div>

    <audio id="notificationSound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto"></audio>

    <script>
        let mealsData = [];
        let ordersList = [];
        let lastOrderCount = 0;

        function openTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        async function loadAdminData() {
            const res = await fetch('/api/data');
            const data = await res.json();
            mealsData = data.meals;
            ordersList = data.orders;
            
            // تنبيه صوتي إذا زاد عدد الطلبات
            if(ordersList.length > lastOrderCount && lastOrderCount !== 0) {
                document.getElementById('notificationSound').play().catch(e => console.log('Sound blocked by browser'));
            }
            lastOrderCount = ordersList.length;

            renderAdminItems();
            renderLiveOrders();
            renderLedgerTable(ordersList);
        }

        function renderAdminItems() {
            document.getElementById('adminItemsList').innerHTML = mealsData.map(m => \`
                <div class="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg bg-gray-50 gap-4">
                    <div class="flex gap-3 items-center w-full md:w-auto">
                        \${m.img ? \`<img src="\${m.img}" class="w-16 h-16 rounded object-cover">\` : ''}
                        <div>
                            <h4 class="font-bold">\${m.name} <span class="text-xs text-gray-500">(\${m.category})</span></h4>
                            <p class="text-green-700 font-bold">\${m.price} دينار</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 w-full md:w-auto justify-end">
                        <div class="relative inline-block w-12 align-middle select-none transition duration-200">
                            <input type="checkbox" id="toggle-\${m.id}" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 cursor-pointer" \${m.available ? 'checked' : ''} onchange="toggleAvail(\${m.id}, this.checked)"/>
                            <label for="toggle-\${m.id}" class="toggle-label block overflow-hidden h-6 rounded-full cursor-pointer"></label>
                        </div>
                        <button onclick="editItem(\${m.id})" class="bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold">تعديل</button>
                        <button onclick="deleteItem(\${m.id})" class="bg-red-500 text-white px-3 py-1 rounded text-sm font-bold">حذف</button>
                    </div>
                </div>
            \`).join('');
        }

        document.getElementById('itemForm').onsubmit = async (e) => {
            e.preventDefault();
            let imgBase64 = null;
            const fileInput = document.getElementById('itemImageFile');
            if(fileInput.files.length > 0) imgBase64 = await fileToBase64(fileInput.files[0]);

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
            openTab('itemsTab'); window.scrollTo(0,0);
        }

        async function deleteItem(id) {
            if(confirm('هل أنت متأكد من الحذف؟')) {
                await fetch('/api/delete-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) });
                loadAdminData();
            }
        }

        async function toggleAvail(id, status) {
            await fetch('/api/toggle-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, status}) });
            loadAdminData();
        }

        // إعدادات الفلاتر (الأقسام)
        async function addCategory() {
            const cat = document.getElementById('newCatName').value.trim();
            if(cat) {
                await fetch('/api/add-category', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cat}) });
                location.reload();
            }
        }
        async function deleteCategory(cat) {
            if(confirm('حذف هذا القسم سيخفيه من التطبيق، هل أنت متأكد؟')) {
                await fetch('/api/delete-category', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cat}) });
                location.reload();
            }
        }

        // الجرد التفصيلي الفواتير
        function renderLedgerTable(list) {
            const total = list.reduce((sum, o) => sum + parseFloat(o.total), 0);
            document.getElementById('ledgerTotalSum').innerText = total.toFixed(2) + " د.أ";
            
            document.getElementById('ledgerTableBody').innerHTML = list.map(o => \`
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4 text-sm text-gray-500">\${new Date(o.timestamp).toLocaleString('ar-EG')}</td>
                    <td class="p-4 font-bold text-gray-800">طاولة \${o.table}</td>
                    <td class="p-4 text-sm">\${o.summary} \${o.notes ? \`<br><span class="text-xs text-red-500">ملاحظات: \${o.notes}</span>\` : ''}</td>
                    <td class="p-4 font-bold text-green-700">\${o.total} د.أ</td>
                </tr>
            \`).join('');
        }

        function filterLedger() {
            let from = document.getElementById('dateFrom').value;
            let to = document.getElementById('dateTo').value;
            if(!from && !to) return renderLedgerTable(ordersList);
            
            let fromTime = from ? new Date(from).setHours(0,0,0,0) : 0;
            let toTime = to ? new Date(to).setHours(23,59,59,999) : Date.now();
            
            let filtered = ordersList.filter(o => o.timestamp >= fromTime && o.timestamp <= toTime);
            renderLedgerTable(filtered);
        }

        // الطلبات الحية
        function renderLiveOrders() {
            document.getElementById('liveOrdersList').innerHTML = ordersList.slice().reverse().map(o => \`
                <div class="bg-white p-4 border rounded-xl shadow-sm border-t-4 border-t-[var(--theme)]">
                    <div class="flex justify-between items-center mb-3 border-b pb-2">
                        <span class="theme-bg px-3 py-1 rounded-md text-sm font-bold">طاولة \${o.table}</span>
                        <span class="text-xs text-gray-400">\${new Date(o.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                    <p class="font-bold text-gray-800 text-sm leading-relaxed">\${o.summary}</p>
                    \${o.notes ? \`<p class="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded">ملاحظة: \${o.notes}</p>\` : ''}
                    <div class="mt-4 text-left">
                        <span class="font-black text-lg theme-text">\${o.total} د.أ</span>
                    </div>
                </div>
            \`).join('');
        }

        async function clearOrders() {
            if(confirm('هل أنت متأكد من مسح جميع الطلبات من الشاشة؟ (سيبقون في الجرد إذا تم حفظهم مسبقاً)')) {
                await fetch('/api/clear-orders', { method: 'POST' });
                loadAdminData();
            }
        }

        async function saveAllSettings() {
            let coverBase64 = null;
            const fileInput = document.getElementById('cfgCover');
            if(fileInput.files.length > 0) coverBase64 = await fileToBase64(fileInput.files[0]);

            const payload = {
                restaurantName: document.getElementById('cfgName').value,
                themeColor: document.getElementById('cfgColor').value,
                tableCount: parseInt(document.getElementById('cfgTables').value),
                thankYouMsg: document.getElementById('cfgThanks').value,
                adminUser: document.getElementById('cfgUser').value,
                adminPass: document.getElementById('cfgPass').value
            };
            if(coverBase64) payload.coverImage = coverBase64;

            await fetch('/api/update-settings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            alert('تم التحديث بنجاح!');
            location.reload();
        }

        loadAdminData();
        setInterval(loadAdminData, 5000); // تحديث أسرع للطلبات (كل 5 ثواني)
    </script>
</body>
</html>
    `);
});

// --- 2. واجهة الزبون (التطبيق متجاوب مع الإعدادات) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>${systemConfig.restaurantName}</title>
    <style>
        :root { --theme: ${systemConfig.themeColor}; }
        .theme-bg { background-color: var(--theme); color: white; }
        .theme-text { color: var(--theme); }
        .theme-border { border-color: var(--theme); }
    </style>
</head>
<body class="bg-gray-50 font-sans pb-24">

    <div id="alertModal" class="fixed inset-0 bg-black/60 z-50 hidden justify-center items-center p-4">
        <div class="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl">
            <div id="alertIcon" class="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4"></div>
            <h3 id="alertTitle" class="text-2xl font-bold mb-2 text-gray-800"></h3>
            <p id="alertMsg" class="text-sm text-gray-600 mb-6 leading-relaxed font-semibold"></p>
            <button onclick="closeAlert()" id="alertBtn" class="w-full text-white p-3 rounded-xl font-bold"></button>
        </div>
    </div>

    <div class="max-w-md mx-auto bg-white min-h-screen shadow-lg relative">
        <div class="h-48 bg-cover bg-center flex items-end p-4 relative" style="background-image: linear-gradient(to top, rgba(0,0,0,0.7), transparent), url('${systemConfig.coverImage}')">
            <h1 class="text-white text-3xl font-bold drop-shadow-lg">${systemConfig.restaurantName}</h1>
        </div>

        <div class="flex gap-2 p-4 overflow-x-auto border-b sticky top-0 bg-white z-10" id="catsContainer"></div>

        <div id="menuContainer" class="p-4 space-y-4"></div>

        <div onclick="openCart()" class="fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-sm theme-bg p-4 rounded-2xl flex justify-between items-center shadow-2xl cursor-pointer hover:opacity-90 transition">
            <div class="flex items-center gap-2">
                <span id="cartBadge" class="bg-white theme-text text-xs px-2 py-1 rounded-full font-bold">0</span>
                <span class="font-bold">مراجعة السلة</span>
            </div>
            <span id="cartTotalBar" class="font-bold">0.00 دينار</span>
        </div>

        <div id="cartModal" class="fixed inset-0 bg-black/50 z-40 hidden justify-center items-end">
            <div class="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b pb-2">
                    <h3 class="text-lg font-bold text-gray-800">تفاصيل الطلب</h3>
                    <button onclick="closeCart()" class="text-gray-400 font-bold text-xl">&times;</button>
                </div>
                <div id="cartItemsList" class="space-y-2 text-sm"></div>
                <div>
                    <label class="block font-bold mb-1 text-sm text-gray-700">الرجاء تحديد رقم الطاولة:</label>
                    <select id="tableNum" class="w-full p-3 border rounded-xl bg-gray-50 font-bold text-lg text-center appearance-none">
                        ${Array.from({length: systemConfig.tableCount}, (_, i) => `<option value="${i+1}">طاولة رقم ${i+1}</option>`).join('')}
                    </select>
                </div>
                <textarea id="orderNotes" placeholder="أي ملاحظات خاصة للمطبخ؟" class="w-full p-3 border rounded-xl text-sm"></textarea>
                
                <div class="flex justify-between font-bold text-lg pt-2">
                    <span>الإجمالي:</span>
                    <span id="modalTotal" class="theme-text">0.00 دينار</span>
                </div>

                <button onclick="submitOrder()" class="w-full theme-bg text-white p-4 rounded-xl font-bold text-lg shadow-md mt-2">شـــراء 💸</button>
            </div>
        </div>
    </div>

    <script>
        let meals = [];
        let categories = [];
        let cart = {};
        let activeCat = "الكل";
        const thankYouMsg = \`${systemConfig.thankYouMsg}\`;

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
                btn.innerText = "تصفح القائمة";
            } else {
                icon.innerHTML = '✓'; icon.className = "w-16 h-16 rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4 bg-green-100 text-green-600";
                btn.className = "w-full p-3 rounded-xl font-bold theme-bg text-white";
                btn.innerText = "العودة للقائمة";
            }
            
            document.getElementById('alertTitle').innerText = title;
            document.getElementById('alertMsg').innerText = msg;
            modal.style.display = 'flex';
        }
        function closeAlert() { document.getElementById('alertModal').style.display = 'none'; }

        function renderCats() {
            document.getElementById('catsContainer').innerHTML = categories.map(c => 
                \`<button onclick="setCat('\${c}')" class="cat-btn px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition border \${c === activeCat ? 'theme-bg theme-border' : 'bg-white text-gray-600 border-gray-300'}" data-cat="\${c}">\${c}</button>\`
            ).join('');
        }

        function setCat(c) {
            activeCat = c;
            document.querySelectorAll('.cat-btn').forEach(btn => {
                if(btn.dataset.cat === c) { btn.classList.add('theme-bg', 'theme-border'); btn.classList.remove('bg-white', 'text-gray-600', 'border-gray-300'); }
                else { btn.classList.remove('theme-bg', 'theme-border'); btn.classList.add('bg-white', 'text-gray-600', 'border-gray-300'); }
            });
            renderMenu();
        }

        function renderMenu() {
            const list = activeCat === "الكل" ? meals : meals.filter(m => m.category === activeCat);
            document.getElementById('menuContainer').innerHTML = list.map(m => \`
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-3 \${!m.available ? 'opacity-60 grayscale' : ''}">
                    \${m.img ? \`<img src="\${m.img}" class="w-24 h-24 rounded-xl object-cover">\` : \`<div class="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs">بدون صورة</div>\`}
                    <div class="flex-1 flex flex-col justify-between py-1">
                        <div>
                            <h4 class="font-bold text-gray-800">\${m.name}</h4>
                            \${!m.available ? \`<span class="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded font-bold">غير متاح حالياً</span>\` : ''}
                        </div>
                        <div class="flex justify-between items-end">
                            <span class="font-black theme-text">\${m.price} د.أ</span>
                            \${m.available ? \`
                                <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button onclick="updateCart(\${m.id}, -1)" class="w-8 h-8 rounded bg-white shadow-sm font-bold text-gray-600">-</button>
                                    <span id="qty-\${m.id}" class="font-bold w-4 text-center">\${cart[m.id] || 0}</span>
                                    <button onclick="updateCart(\${m.id}, 1)" class="w-8 h-8 rounded theme-bg text-white shadow-sm font-bold">+</button>
                                </div>
                            \` : \`<span class="text-red-500 font-bold text-xs">نفذت الكمية</span>\`}
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
            document.getElementById('modalTotal').innerText = total.toFixed(2) + " دينار";
            return total;
        }

        function openCart() {
            if(Object.keys(cart).length === 0) return showCustomAlert('empty', 'سلتك فارغة!', 'اختر وجباتك المفضلة من القائمة قبل الشراء.');
            const list = document.getElementById('cartItemsList');
            list.innerHTML = Object.keys(cart).map(id => {
                let m = meals.find(x => x.id == id);
                return \`<div class="flex justify-between border-b pb-2"><span>\${m.name} <b class="theme-text">x\${cart[id]}</b></span><b>\${(m.price*cart[id]).toFixed(2)} د.أ</b></div>\`;
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
            showCustomAlert('success', 'تم الطلب بنجاح!', thankYouMsg);
        }

        init();
    </script>
</body>
</html>
    `);
});

// --- 3. مسارات الـ API للواجهات ---
app.get('/api/data', (req, res) => res.json({ meals: mealsData, categories: categories, orders: ordersList }));

app.post('/api/save-item', (req, res) => {
    const { id, name, price, category, img } = req.body;
    let existing = mealsData.find(m => m.id == id);
    if(existing) { Object.assign(existing, {name, price: parseFloat(price), category, img: img || existing.img}); } 
    else { mealsData.push({ id, name, price: parseFloat(price), category, img, available: true }); }
    res.json({success: true});
});

app.post('/api/delete-item', (req, res) => { mealsData = mealsData.filter(m => m.id != req.body.id); res.json({success: true}); });
app.post('/api/toggle-item', (req, res) => { const item = mealsData.find(m => m.id == req.body.id); if(item) item.available = req.body.status; res.json({success: true}); });

// فلاتر المجموعات
app.post('/api/add-category', (req, res) => { if(!categories.includes(req.body.cat)) categories.push(req.body.cat); res.json({success: true}); });
app.post('/api/delete-category', (req, res) => { categories = categories.filter(c => c !== req.body.cat); res.json({success: true}); });

// تحديث الإعدادات كاملة
app.post('/api/update-settings', (req, res) => {
    Object.assign(systemConfig, req.body);
    res.json({success: true});
});

app.post('/api/submit-order', (req, res) => {
    const newOrder = { id: Date.now(), ...req.body, timestamp: Date.now() };
    ordersList.push(newOrder);
    
    // إضافة الطلب إلى طابور الطباعة للاردوينو
    printQueue.push(newOrder); 
    
    res.json({success: true});
});

app.post('/api/clear-orders', (req, res) => {
    ordersList = []; // مسح الطلبات الحية
    res.json({success: true});
});


// --- 4. نقطة اتصال (API) مخصصة للاردوينو/ESP32 لسحب الطلبات وطباعتها ---
// الاردوينو لازم يعمل GET Request على: https://[your-app-url]/api/arduino-print
app.get('/api/arduino-print', (req, res) => {
    if(printQueue.length > 0) {
        // سحب أول طلب في الطابور وإرساله
        const job = printQueue.shift(); 
        
        // تجهيز النص للطباعة بصيغة يفهمها الاردوينو بسهولة عبر Serial
        let printText = `--- المطعم: ${systemConfig.restaurantName} ---\n`;
        printText += `طاولة رقم: ${job.table}\n`;
        printText += `الطلب: ${job.summary}\n`;
        if(job.notes) printText += `ملاحظات: ${job.notes}\n`;
        printText += `الاجمالي: ${job.total} دينار\n`;
        printText += `-------------------\n`;
        printText += `CUT_PAPER\n`; // كلمة سرية يقرأها الاردوينو لينفذ كود القص GS V 1
        
        res.send(printText);
    } else {
        res.send("NO_ORDERS");
    }
});

app.listen(port, () => console.log(`Super System Running on port ${port}`));
