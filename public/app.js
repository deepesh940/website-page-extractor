const UIElements = {
    step1: document.getElementById('step-1'),
    step2: document.getElementById('step-2'),
    step3: document.getElementById('step-3'),
    step4: document.getElementById('step-4'),
    btnExtract: document.getElementById('btn-extract'),
    extractLoader: document.getElementById('extract-loader'),
    inputUrl: document.getElementById('portal-url'),
    errorText: document.getElementById('extract-error'),
    linkCount: document.getElementById('link-count'),
    linksContainer: document.getElementById('links-container'),
    btnCopyBulk: document.getElementById('btn-copy-bulk'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnDeselectAll: document.getElementById('btn-deselect-all'),
    btnBack: document.getElementById('btn-back'),
    btnDownloadSingle: document.getElementById('btn-download-single'),
    btnRestart: document.getElementById('btn-restart'),
};

let extractedLinks = [];

function switchStep(stepId) {
    document.querySelectorAll('.card').forEach(c => {
        c.classList.remove('active');
        setTimeout(() => c.classList.add('hidden'), 400); // Wait for fade out
    });
    
    setTimeout(() => {
        document.getElementById(stepId).classList.remove('hidden');
        setTimeout(() => document.getElementById(stepId).classList.add('active'), 10);
    }, 410);
}

UIElements.btnExtract.addEventListener('click', async () => {
    const url = UIElements.inputUrl.value.trim();
    if (!url) {
        showError('Please enter a valid URL.');
        return;
    }
    
    try {
        new URL(url);
    } catch {
        showError('Invalid URL format. Include http:// or https://');
        return;
    }

    setLoading(true);
    UIElements.errorText.classList.add('hidden');

    try {
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to extract links');

        extractedLinks = data.links;
        if (extractedLinks.length === 0) {
            showError('No valid documentation links found on this page.');
            setLoading(false);
            return;
        }

        renderLinks(extractedLinks);
        switchStep('step-2');
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
});

function showError(msg) {
    UIElements.errorText.textContent = msg;
    UIElements.errorText.classList.remove('hidden');
}

function setLoading(isLoading) {
    UIElements.btnExtract.disabled = isLoading;
    if (isLoading) {
        UIElements.extractLoader.classList.remove('hidden');
        UIElements.btnExtract.querySelector('.btn-text').textContent = 'Extracting...';
    } else {
        UIElements.extractLoader.classList.add('hidden');
        UIElements.btnExtract.querySelector('.btn-text').textContent = 'Extract Links';
    }
}

function renderLinks(links) {
    UIElements.linkCount.textContent = links.length;
    UIElements.linksContainer.innerHTML = '';
    
    links.forEach((link, idx) => {
        const item = document.createElement('label');
        item.className = 'list-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = link.url;
        checkbox.checked = true;
        
        const customBox = document.createElement('div');
        customBox.className = 'custom-checkbox';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'list-item-content';
        textDiv.innerHTML = `<span class="link-title">${link.title}</span><span class="link-url">${link.url}</span>`;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-link-btn';
        copyBtn.title = 'Copy Link';
        const copyIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6C4.89543 16 4 15.1046 4 14V6C4 4.89543 4.89543 4 6 4H14C15.1046 4 16 4.89543 16 6V8M10 8H18C19.1046 8 20 8.89543 20 10V18C20 19.1046 19.1046 20 18 20H10C8.89543 20 8 19.1046 8 18V10C8 8.89543 8.89543 8 10 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        copyBtn.innerHTML = copyIcon;
        copyBtn.onclick = (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(link.url);
            copyBtn.innerHTML = '<span class="copied-text">Copied!</span>';
            setTimeout(() => { copyBtn.innerHTML = copyIcon; }, 2000);
        };
        
        item.appendChild(checkbox);
        item.appendChild(customBox);
        item.appendChild(textDiv);
        item.appendChild(copyBtn);
        
        UIElements.linksContainer.appendChild(item);
    });
}

UIElements.btnCopyBulk.addEventListener('click', () => {
    const selectedCheckboxes = document.querySelectorAll('.list-item input[type="checkbox"]:checked');
    const selectedUrls = Array.from(selectedCheckboxes).map(c => c.value);
    
    if (selectedUrls.length === 0) {
        alert('Please select at least one article to copy.');
        return;
    }
    
    navigator.clipboard.writeText(selectedUrls.join('\n')).then(() => {
        const originalText = UIElements.btnCopyBulk.textContent;
        UIElements.btnCopyBulk.textContent = 'Copied!';
        setTimeout(() => UIElements.btnCopyBulk.textContent = originalText, 2000);
    });
});

UIElements.btnSelectAll.addEventListener('click', () => {
    document.querySelectorAll('.list-item input[type="checkbox"]').forEach(c => c.checked = true);
});

UIElements.btnDeselectAll.addEventListener('click', () => {
    document.querySelectorAll('.list-item input[type="checkbox"]').forEach(c => c.checked = false);
});

UIElements.btnBack.addEventListener('click', () => {
    switchStep('step-1');
});

async function handleDownload() {
    const selectedCheckboxes = document.querySelectorAll('.list-item input[type="checkbox"]:checked');
    const selectedUrls = Array.from(selectedCheckboxes).map(c => c.value);
    
    if (selectedUrls.length === 0) {
        alert('Please select at least one article to download.');
        return;
    }

    switchStep('step-3');
    
    const progressBar = document.getElementById('progress-bar');
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 5;
            progressBar.style.width = `${Math.min(progress, 90)}%`;
        }
    }, 2000);

    try {
        const endpoint = '/api/download-single';
        const filename = 'KnowledgeBase-Merged.pdf';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: selectedUrls })
        });

        if (!response.ok) throw new Error('Download failed on server');

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        setTimeout(() => switchStep('step-4'), 500);

    } catch (err) {
        clearInterval(progressInterval);
        alert('An error occurred during download: ' + err.message);
        switchStep('step-2');
    }
}

UIElements.btnDownloadSingle.addEventListener('click', handleDownload);

UIElements.btnRestart.addEventListener('click', () => {
    UIElements.inputUrl.value = '';
    extractedLinks = [];
    switchStep('step-1');
});
