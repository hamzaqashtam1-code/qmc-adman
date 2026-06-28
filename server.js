app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #f8f9fa; padding: 20px; }
                .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                h1 { color: #1e4620; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; border-bottom: 1px solid #eee; text-align: right; }
                .btn { padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; color: white; }
                .btn-toggle { background: #1e4620; }
                .form-group { margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px; }
                input { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; width: 200px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>لوحة الإدارة - QMC</h1>
                <table>
                    <tr><th>اسم الوجبة</th><th>السعر</th><th>الحالة</th><th>تحكم</th></tr>
                    ${mealsData.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.price} دينار</td>
                            <td>${m.available ? '✅ متاحة' : '❌ مخفية'}</td>
                            <td><button class="btn btn-toggle" onclick="toggle(${m.id}, ${!m.available})">تبديل</button></td>
                        </tr>
                    `).join('')}
                </table>
                <div class="form-group">
                    <h3>إضافة صنف جديد</h3>
                    <input type="text" id="name" placeholder="اسم الوجبة">
                    <input type="number" id="price" placeholder="السعر">
                    <button class="btn btn-toggle" onclick="addMeal()">إضافة للـ Menu</button>
                </div>
            </div>
            <script>
                async function toggle(id, status) {
                    await fetch('/api/toggle-meal-status', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ mealId: id, available: status })
                    });
                    location.reload();
                }
                async function addMeal() {
                    const name = document.getElementById('name').value;
                    const price = document.getElementById('price').value;
                    alert("الميزة جاهزة! سنربطها الآن بقاعدة البيانات.");
                }
            </script>
        </body>
        </html>
    `);
});
