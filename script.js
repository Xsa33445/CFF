document.addEventListener('DOMContentLoaded', () => {
    const requestsTableBody = document.querySelector('#requests-table tbody');
    const licensesTableBody = document.querySelector('#licenses-table tbody');
    const modal = document.getElementById('approve-modal');
    const modalHwidText = document.getElementById('modal-hwid-text');
    const licenseDaysInput = document.getElementById('license-days');
    const confirmBtn = document.getElementById('confirm-approval');
    const cancelBtn = document.getElementById('cancel-approval');
    const toastContainer = document.getElementById('toast-container');
    
    let hwidToApprove = null;

    // --- Veri Çekme ve Tablo Doldurma ---
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
            showToast('Veriler yüklenemedi.', 'error');
        }
    }

    function populateTables(requests, licenses) {
        requestsTableBody.innerHTML = '';
        if (Object.keys(requests).length === 0) {
            requestsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Bekleyen istek yok.</td></tr>';
        } else {
            for (const hwid in requests) {
                const req = requests[hwid];
                requestsTableBody.innerHTML += `
                    <tr>
                        <td>${hwid}</td>
                        <td>${req.requested_at}</td>
                        <td>
                            <button class="btn btn-approve" data-hwid="${hwid}"><i class="fa-solid fa-check"></i> Onayla</button>
                            <button class="btn btn-deny" data-hwid="${hwid}"><i class="fa-solid fa-times"></i> Reddet</button>
                        </td>
                    </tr>`;
            }
        }

        licensesTableBody.innerHTML = '';
        if (Object.keys(licenses).length === 0) {
            licensesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aktif lisans yok.</td></tr>';
        } else {
            for (const hwid in licenses) {
                const lic = licenses[hwid];
                licensesTableBody.innerHTML += `
                    <tr>
                        <td>${hwid}</td>
                        <td>${formatDate(lic.created_at)}</td>
                        <td>${formatDate(lic.expires_at)}</td>
                        <td>${calculateTimeRemaining(lic.expires_at)}</td>
                        <td>
                            <button class="btn btn-delete" data-hwid="${hwid}"><i class="fa-solid fa-trash-can"></i> Sil</button>
                        </td>
                    </tr>`;
            }
        }
    }
    
    // --- Yardımcı Fonksiyonlar ---
    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('tr-TR');
    }

    function calculateTimeRemaining(expiryDateString) {
        const now = new Date();
        const expiry = new Date(expiryDateString);
        const diff = expiry - now;

        if (diff <= 0) return '<span style="color:var(--error-color);">Süresi Doldu</span>';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        return `${days} gün ${hours} saat`;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- Modal Yönetimi ---
    function openModal(hwid) {
        hwidToApprove = hwid;
        modalHwidText.textContent = `HWID: ${hwid}`;
        modal.style.display = 'flex';
    }

    function closeModal() {
        hwidToApprove = null;
        modal.style.display = 'none';
        licenseDaysInput.value = '30';
    }

    // --- Aksiyonlar ve API İstekleri ---
    async function postAction(url, body, successMessage) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (response.ok) {
                showToast(successMessage, 'success');
                fetchData();
            } else {
                showToast(result.message || 'Bir hata oluştu.', 'error');
            }
        } catch (error) {
            console.error('İşlem hatası:', error);
            showToast('Sunucuya bağlanılamadı.', 'error');
        }
    }

    // --- Olay Dinleyicileri (Event Listeners) ---
    document.body.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const hwid = button.dataset.hwid;

        if (button.classList.contains('btn-approve')) openModal(hwid);
        if (button.classList.contains('btn-deny')) {
            if (confirm(`"${hwid}" isteğini reddetmek istediğinizden emin misiniz?`)) {
                await postAction(`/api/deny/${hwid}`, {}, `İstek reddedildi.`);
            }
        }
        if (button.classList.contains('btn-delete')) {
            if (confirm(`"${hwid}" lisansını silmek istediğinizden emin misiniz?`)) {
                await postAction(`/api/delete_license/${hwid}`, {}, `Lisans silindi.`);
            }
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const days = parseInt(licenseDaysInput.value);
        if (days > 0) {
            await postAction(`/api/approve/${hwidToApprove}`, { days }, `${days} günlük lisans oluşturuldu.`);
            closeModal();
        } else {
            showToast('Lütfen geçerli bir gün sayısı girin.', 'error');
        }
    });

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if(event.target === modal) closeModal();
    });

    // --- Başlangıç ---
    fetchData();
    setInterval(fetchData, 30000); // Tabloları her 30 saniyede bir yenile
});
