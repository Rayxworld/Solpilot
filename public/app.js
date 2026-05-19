const form = document.getElementById("signal-form");
const symbolInput = document.getElementById("symbol");
const responseEl = document.getElementById("response");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = symbolInput.value.trim();

  if (!symbol) {
    responseEl.innerHTML = "<p>Please enter a token symbol like SOL, BONK, or WIF.</p>";
    return;
  }

  responseEl.innerHTML = `
    <div class="loader-container">
      <div class="loader"></div>
      <p>Analyzing ${symbol.toUpperCase()} & generating market signal...</p>
    </div>
  `;

  try {
    const result = await fetch("/api/signal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symbol })
    });

    const data = await result.json();

    if (!result.ok) {
      responseEl.innerHTML = `<p class="error-text">${data.error || "Unable to generate a signal."}</p>`;
      return;
    }

    let metricsHtml = "";
    if (data.pairData) {
      const price = data.pairData.priceUsd ? `$${parseFloat(data.pairData.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "N/A";
      const changeVal = data.pairData.priceChange24h;
      const changeClass = changeVal >= 0 ? "positive" : changeVal < 0 ? "negative" : "neutral";
      const changeText = changeVal !== undefined ? `${changeVal >= 0 ? "+" : ""}${changeVal}%` : "N/A";
      const liquidity = data.pairData.liquidityUsd ? `$${Math.round(data.pairData.liquidityUsd).toLocaleString()}` : "N/A";
      const volume = data.pairData.volume24h ? `$${Math.round(data.pairData.volume24h).toLocaleString()}` : "N/A";
      const dex = data.pairData.dexId ? data.pairData.dexId.toUpperCase() : "N/A";
      const address = data.pairData.address || "";

      metricsHtml = `
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">Price USD</span>
            <span class="metric-value highlight">${price}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">24h Change</span>
            <span class="metric-value ${changeClass}">${changeText}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Liquidity</span>
            <span class="metric-value">${liquidity}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Volume 24h</span>
            <span class="metric-value">${volume}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">DEX Pool</span>
            <span class="metric-value">${dex}</span>
          </div>
        </div>
        ${address ? `
        <div class="address-container">
          <span class="address-label">Mint Address:</span>
          <span class="address-value">${address}</span>
        </div>` : ""}
      `;
    } else {
      metricsHtml = `
        <div class="no-metrics">
          <p>⚠️ No live trading metrics found. Displaying AI model estimates only.</p>
        </div>
      `;
    }

    responseEl.innerHTML = `
      <div class="signal-result animate-fade-in">
        <div class="signal-header">
          <span class="badge">LIVE SIGNAL</span>
          <h3>${data.symbol} Trading Insight</h3>
        </div>
        
        ${metricsHtml}
        
        <div class="signal-analysis">
          <h4>AI Market Commentary</h4>
          <p>${data.signal}</p>
        </div>
      </div>
    `;
  } catch (error) {
    responseEl.innerHTML = "<p class=\"error-text\">Network error while requesting the signal.</p>";
    console.error(error);
  }
});
