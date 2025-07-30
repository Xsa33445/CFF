// Bu dosyanın içeriği önceki cevapta verilenle aynı kalacak.
document.addEventListener('DOMContentLoaded', () => {
    // ... Önceki yanıttaki JavaScript kodunun tamamı buraya gelecek ...
    const requestsTableBody = document.querySelector('#requests-table tbody');
    const licensesTableBody = document.querySelector('#licenses-table tbody');

    async function fetchData() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                if (response.status === 401) window.location.href = '/';
                return;
            }
            const data = await response.json();
            populateTables(data.requests, data.licenses);
        } catch (error) {
            console.error('Veri alınırken hata oluştu:', error);
        }
    }

    function populateTables(requests, licenses) {
        requestsTableBody.innerHTML = '';
        for (const hwid in requests) {
            const req = requests[hwid];
            const row = `
                <tr>
                    <td>${hwid}</td>
                    <td>${req.requested_at}</td>
                    <td>
                        <button class="btn btn-approve" data-hwid="${hwid}">Onayla</button>
                        <button class="btn btn-deny" data-hwid="${hwid}">Reddet</button>
                    </td>
                </tr>
            `;
            requestsTableBody.innerHTML += row;
        }

        licensesTableBody.innerHTML = '';
        for (const hwid in licenses) {
            const lic = licenses[hwid];
            const row = `
                <tr>
                    <td>${hwid}</td>
                    <td>${lic.created_at}</td>
                    <td>${lic.expires_at}</td>
                    <td>
                        <button class="btn btn-delete" data-hwid="${hwid}">Sil</button>
                    </td>
                </tr>
            `;
            licensesTableBody.innerHTML += row;
        }
    }

    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        const hwid = target.dataset.hwid;

        if (target.classList.contains('btn-approve')) {
            const days = prompt(`"${hwid}" için kaç günlük lisans oluşturulsun?`, "30");
            if (days && !isNaN(days) && parseInt(days) > 0) {
                await postAction(`/api/approve/${hwid}`, { days: parseInt(days) });
            }
        }

        if (target.classList.contains('btn-deny')) {
            if (confirm(`"${hwid}" isteğini reddetmek istediğinizden emin misiniz?`)) {
                await postAction(`/api/deny/${hwid}`);
            }
        }

        if (target.classList.contains('btn-delete')) {
            if (confirm(`"${hwid}" lisansını silmek istediğinizden emin misiniz?`)) {
                await postAction(`/api/delete_license/${hwid}`);
            }
        }
    });

    async function postAction(url, body = {}) {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            fetchData();
        } catch (error) {
            console.error('İşlem gerçekleştirilemedi:', error);
        }
    }

    fetchData();
});
