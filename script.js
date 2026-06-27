// ============================================================================
// Expense & Budget Visualizer - JavaScript
// ============================================================================

// ============================================================================
// Constants
// ============================================================================
const STORAGE_KEY = 'expense_tracker_data';
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
// DOM Elements
// ============================================================================
const transactionForm = document.getElementById('transactionForm');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const typeInputs = document.querySelectorAll('input[name="type"]');
const transactionsList = document.getElementById('transactionsList');
const clearBtn = document.getElementById('clearBtn');
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const chartCanvas = document.getElementById('spendingChart');

let chart = null;

// ============================================================================
// Event Listeners
// ============================================================================
transactionForm.addEventListener('submit', handleAddTransaction);
clearBtn.addEventListener('click', handleClearAll);

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
 * Render transactions list
 */
function renderTransactions() {
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="empty-state">No transactions yet. Add one to get started!</p>';
        return;
    }

    transactionsList.innerHTML = transactions
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

    if (categories.length === 0) {
        // Show empty state
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6B7280';
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
                    borderColor: '#FFFFFF',
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
                        color: '#334155',
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
    // Update UI with loaded data
    updateUI();

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
// Service Worker for offline support (optional enhancement)
// ============================================================================
if ('serviceWorker' in navigator) {
    // Service worker registration could be added here for PWA support
    // Currently omitted as per simplicity requirement
}
