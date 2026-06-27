// ============================================================================
// Expense & Budget Visualizer - JavaScript
// ============================================================================

// ============================================================================
// Constants
// ============================================================================
const STORAGE_KEY = 'expense_tracker_data';
const THEME_KEY   = 'expense_tracker_theme';
const CHART_CONFIG = {
    colors: {
        'Food': '#EF4444',
        'Transport': '#F97316',
        'Shopping': '#D946EF',
        'Entertainment': '#0EA5E9',
        'Utilities': '#6366F1',
        'Health': '#10B981',
        'Education': '#8B5CF6',
        'Other': '#6B7280'
    }
};

// ============================================================================
// State Management
// ============================================================================

/**
 * Load transactions from Local Storage
 */
function loadTransactions() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Save transactions to Local Storage
 */
function saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/**
 * Get all transactions from storage
 */
let transactions = loadTransactions();

// ============================================================================
// Theme Management
// ============================================================================

/**
 * Get the effective theme:
 *   1. User's saved preference (LocalStorage)
 *   2. OS/browser preference (prefers-color-scheme)
 *   3. Default: light
 */
function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Apply a theme to the document and update the toggle button label.
 * Does NOT save to LocalStorage — call saveTheme() for that.
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    const label = document.getElementById('themeLabel');
    if (label) {
        label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }

    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        btn.setAttribute('title',      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

/**
 * Save theme preference to LocalStorage
 */
function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
}

/**
 * Toggle between light and dark, persist the choice, and re-render the chart
 * so legend/empty-state colors update immediately.
 */
function handleThemeToggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    // Re-render chart so legend colour matches the new theme
    updateChart();
}

// ============================================================================
// DOM Elements
// ============================================================================
const transactionForm  = document.getElementById('transactionForm');
const descriptionInput = document.getElementById('description');
const amountInput      = document.getElementById('amount');
const categoryInput    = document.getElementById('category');
const typeInputs       = document.querySelectorAll('input[name="type"]');
const transactionsList = document.getElementById('transactionsList');
const clearBtn         = document.getElementById('clearBtn');
const totalBalanceEl   = document.getElementById('totalBalance');
const totalIncomeEl    = document.getElementById('totalIncome');
const totalExpenseEl   = document.getElementById('totalExpense');
const chartCanvas      = document.getElementById('spendingChart');
const themeToggleBtn   = document.getElementById('themeToggle');

// Filter & export elements
const searchInput      = document.getElementById('searchInput');
const filterCategory   = document.getElementById('filterCategory');
const filterType       = document.getElementById('filterType');
const clearFilterBtn   = document.getElementById('clearFilterBtn');
const exportBtn        = document.getElementById('exportBtn');
const transactionCount = document.getElementById('transactionCount');

let chart = null;

// ============================================================================
// Event Listeners
// ============================================================================
transactionForm.addEventListener('submit', handleAddTransaction);
clearBtn.addEventListener('click', handleClearAll);
themeToggleBtn.addEventListener('click', handleThemeToggle);

// ============================================================================
// Transaction Management
// ============================================================================

/**
 * Handle adding a new transaction
 * Validates input, adds to state, saves to storage, and updates UI
 */
function handleAddTransaction(e) {
    e.preventDefault();

    // Get form values
    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categoryInput.value;
    const type = document.querySelector('input[name="type"]:checked').value;

    // Validate inputs
    if (!description || !amount || amount <= 0 || !category) {
        alert('Please fill in all fields with valid values');
        return;
    }

    // Create transaction object
    const transaction = {
        id: Date.now(), // Simple unique ID using timestamp
        description,
        amount,
        category,
        type,
        date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),
        time: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
    };

    // Add to transactions array
    transactions.unshift(transaction);

    // Save to Local Storage
    saveTransactions(transactions);

    // Reset form
    transactionForm.reset();
    categoryInput.value = '';

    // Update UI
    updateUI();

    // Show success feedback (subtle)
    descriptionInput.focus();
}

/**
 * Delete a transaction by ID
 */
function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions(transactions);
    updateUI();
}

/**
 * Handle clearing all transactions
 */
function handleClearAll() {
    if (transactions.length === 0) {
        alert('No transactions to clear');
        return;
    }

    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
        transactions = [];
        saveTransactions(transactions);
        updateUI();
    }
}

// ============================================================================
// Calculations
// ============================================================================

/**
 * Calculate total balance (income - expenses)
 */
function calculateBalance() {
    let balance = 0;
    transactions.forEach(t => {
        if (t.type === 'income') {
            balance += t.amount;
        } else {
            balance -= t.amount;
        }
    });
    return balance;
}

/**
 * Calculate total income
 */
function calculateTotalIncome() {
    return transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate total expenses
 */
function calculateTotalExpense() {
    return transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate spending by category (only expenses)
 */
function calculateSpendingByCategory() {
    const spending = {};

    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            spending[t.category] = (spending[t.category] || 0) + t.amount;
        });

    return spending;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update dashboard statistics
 */
function updateDashboard() {
    const balance = calculateBalance();
    const income = calculateTotalIncome();
    const expense = calculateTotalExpense();

    totalBalanceEl.textContent = formatCurrency(balance);
    totalIncomeEl.textContent = formatCurrency(income);
    totalExpenseEl.textContent = formatCurrency(expense);
}

/**
 * Render transactions list, respecting any active search/filter state
 */
function renderTransactions() {
    const total    = transactions.length;
    const filtered = applyFilters(transactions);

    // Update count badge
    updateTransactionCount(filtered.length, total);

    if (total === 0) {
        transactionsList.innerHTML = '<p class="empty-state">No transactions yet. Add one to get started!</p>';
        return;
    }

    if (filtered.length === 0) {
        transactionsList.innerHTML = `
            <div class="filter-empty">
                <span class="filter-empty__icon">🔍</span>
                No transactions match your filters.
            </div>`;
        return;
    }

    transactionsList.innerHTML = filtered
        .map(t => `
            <div class="transaction-item ${t.type}">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(t.description)}</div>
                    <div class="transaction-meta">
                        <span>${t.category}</span> • <span>${t.date} ${t.time}</span>
                    </div>
                </div>
                <div class="transaction-amount">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount).replace('$', '')}
                </div>
                <button class="transaction-delete" onclick="deleteTransaction(${t.id})" 
                        aria-label="Delete transaction" title="Delete">
                    ×
                </button>
            </div>
        `)
        .join('');
}

/**
 * Update chart visualization
 */
function updateChart() {
    const spendingData = calculateSpendingByCategory();
    const categories = Object.keys(spendingData);
    const amounts = Object.values(spendingData);

    // Prepare colors array based on categories
    const chartColors = categories.map(cat => CHART_CONFIG.colors[cat] || '#6B7280');

    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }

    // Create new chart
    const ctx = chartCanvas.getContext('2d');

    // Read theme-aware colors from CSS variables at render time
    const computedStyle    = getComputedStyle(document.documentElement);
    const legendColor      = computedStyle.getPropertyValue('--chart-legend-color').trim() || '#334155';
    const emptyColor       = computedStyle.getPropertyValue('--chart-empty-color').trim()  || '#6B7280';
    const isDark           = document.documentElement.getAttribute('data-theme') === 'dark';
    const borderColor      = isDark ? '#1E293B' : '#FFFFFF';

    if (categories.length === 0) {
        // Show empty state
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = emptyColor;
        ctx.textAlign = 'center';
        ctx.fillText('No expenses yet. Add a transaction to see the chart.', 
                     chartCanvas.width / 2, chartCanvas.height / 2);
        return;
    }

    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [
                {
                    data: amounts,
                    backgroundColor: chartColors,
                    borderColor: borderColor,
                    borderWidth: 3,
                    borderRadius: 8,
                    spacing: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14,
                            family: "system-ui, -apple-system, sans-serif"
                        },
                        color: legendColor,
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 14, weight: '600' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Main UI update function
 * Call this whenever data changes
 */
function updateUI() {
    updateDashboard();
    renderTransactions();
    updateChart();
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the app on page load
 */
function initializeApp() {
    // Apply saved/preferred theme before rendering UI (avoids flash)
    applyTheme(getInitialTheme());

    // Update UI with loaded data
    updateUI();

    // Wire up search/filter and export
    initFilters();
    exportBtn.addEventListener('click', handleExportCSV);

    // Verify Local Storage is working
    testLocalStorage();

    // Log initialization complete (for development/debugging)
    console.log('Expense Tracker initialized successfully');
    console.log('Loaded transactions:', transactions.length);
}

/**
 * Test Local Storage functionality
 */
function testLocalStorage() {
    try {
        const testKey = '__localStorage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        console.log('✓ Local Storage is working correctly');
    } catch (e) {
        console.warn('⚠ Local Storage may not be available:', e);
        alert('Warning: Local Storage is not available. Your data may not persist.');
    }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================================================
// Search & Filter
// ============================================================================

/**
 * Get current filter values
 */
function getFilters() {
    return {
        search:   searchInput.value.trim().toLowerCase(),
        category: filterCategory.value,
        type:     filterType.value
    };
}

/**
 * Apply filters to the full transactions array and return matching items
 */
function applyFilters(list) {
    const { search, category, type } = getFilters();
    return list.filter(t => {
        const matchSearch   = !search   || t.description.toLowerCase().includes(search);
        const matchCategory = !category || t.category === category;
        const matchType     = !type     || t.type === type;
        return matchSearch && matchCategory && matchType;
    });
}

/**
 * Toggle the visual "active" state on filter inputs
 */
function syncFilterHighlights() {
    const { search, category, type } = getFilters();
    searchInput.classList.toggle('is-active',    !!search);
    filterCategory.classList.toggle('is-active', !!category);
    filterType.classList.toggle('is-active',     !!type);
}

/**
 * Update the transaction count badge
 */
function updateTransactionCount(visible, total) {
    if (!transactionCount) return;
    if (total === 0) {
        transactionCount.textContent = '';
        transactionCount.style.display = 'none';
        return;
    }
    transactionCount.style.display = '';
    transactionCount.textContent = visible < total ? `${visible} / ${total}` : total;
}

/**
 * Attach live filter listeners
 */
function initFilters() {
    searchInput.addEventListener('input',    handleFilterChange);
    filterCategory.addEventListener('change', handleFilterChange);
    filterType.addEventListener('change',    handleFilterChange);
    clearFilterBtn.addEventListener('click', handleClearFilters);
}

/**
 * Re-render the list whenever any filter changes
 */
function handleFilterChange() {
    syncFilterHighlights();
    renderTransactions();
}

/**
 * Reset all filters and re-render
 */
function handleClearFilters() {
    searchInput.value    = '';
    filterCategory.value = '';
    filterType.value     = '';
    syncFilterHighlights();
    renderTransactions();
}

// ============================================================================
// Export to CSV
// ============================================================================

/**
 * Convert transactions array to a CSV string and trigger download
 */
function handleExportCSV() {
    if (transactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    const headers = ['Description', 'Amount', 'Type', 'Category', 'Date', 'Time'];

    const rows = transactions.map(t => [
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        t.type,
        t.category,
        t.date,
        t.time
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob       = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url        = URL.createObjectURL(blob);

    const link    = document.createElement('a');
    link.href     = url;
    link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================================================
// Service Worker for offline support (optional enhancement)
// ============================================================================
if ('serviceWorker' in navigator) {
    // Service worker registration could be added here for PWA support
    // Currently omitted as per simplicity requirement
}
