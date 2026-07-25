document.addEventListener('DOMContentLoaded', () => {
  const auditForm = document.getElementById('auditForm');
  const urlInput = document.getElementById('urlInput');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');
  const errorAlert = document.getElementById('errorAlert');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const errorRequestId = document.getElementById('errorRequestId');
  const resultsSection = document.getElementById('resultsSection');

  // Quick action sample buttons
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      urlInput.value = btn.dataset.url;
      auditForm.dispatchEvent(new Event('submit'));
    });
  });

  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    // UI Loading state
    setLoading(true);
    hideError();
    resultsSection.classList.add('hidden');

    try {
      const response = await fetch(`/api/v1/audit?url=${encodeURIComponent(url)}`);
      const payload = await response.json();

      if (!response.ok) {
        showError(payload.error?.code || 'ERROR', payload.error?.message || 'Audit request failed.', payload.error?.requestId);
        return;
      }

      renderResults(payload.data, response.headers.get('X-Cache'));
    } catch (err) {
      showError('NETWORK_ERROR', 'Failed to communicate with the PagePulse service.', '');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.textContent = 'Auditing...';
      spinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Audit URL';
      spinner.classList.add('hidden');
    }
  }

  function showError(code, msg, reqId) {
    errorTitle.textContent = `Error: ${code}`;
    errorMessage.textContent = msg;
    errorRequestId.textContent = reqId ? `Request ID: ${reqId}` : '';
    errorAlert.classList.remove('hidden');
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  function renderResults(data, cacheHeader) {
    const { metrics, headers, securityFlags, cached } = data;

    // Cache badge
    const cacheBadge = document.getElementById('cacheBadge');
    const isHit = cached || cacheHeader === 'HIT';
    cacheBadge.textContent = isHit ? 'CACHE HIT' : 'CACHE MISS';
    cacheBadge.className = `cache-badge ${isHit ? 'hit' : 'miss'}`;

    // Metrics
    document.getElementById('valResponseTime').textContent = `${metrics.responseTimeMs} ms`;
    
    const statusCodeEl = document.getElementById('valStatusCode');
    statusCodeEl.textContent = `${metrics.statusCode} ${metrics.statusText}`;
    statusCodeEl.style.color = metrics.statusCode >= 200 && metrics.statusCode < 400 ? 'var(--success)' : 'var(--danger)';

    const sslEl = document.getElementById('valSslSecure');
    sslEl.textContent = metrics.isSslSecure ? 'HTTPS (Secure)' : 'HTTP (Unencrypted)';
    sslEl.style.color = metrics.isSslSecure ? 'var(--success)' : 'var(--warning)';

    document.getElementById('valContentSize').textContent = `${(metrics.contentLengthBytes / 1024).toFixed(2)} KB`;

    // Security Pills
    setSecurityPill('flagHsts', securityFlags.hasHsts);
    setSecurityPill('flagCsp', securityFlags.hasCsp);
    setSecurityPill('flagXContentType', securityFlags.hasXContentTypeOptions);
    setSecurityPill('flagXFrame', securityFlags.hasFrameOptions);

    // Headers
    document.getElementById('headersJson').textContent = JSON.stringify(headers, null, 2);

    resultsSection.classList.remove('hidden');
  }

  function setSecurityPill(id, isPassed) {
    const el = document.getElementById(id);
    el.textContent = isPassed ? 'PRESENT' : 'MISSING';
    el.className = `status-pill ${isPassed ? 'pass' : 'fail'}`;
  }
});
