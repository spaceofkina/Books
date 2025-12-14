// Configuration
const API_BASE_URL = 'https://library-backend-api-crud-1.onrender.com/api';
let currentEditId = null;
let currentEditType = null;

// DOM Elements
const sections = document.querySelectorAll('.section');
const navBtns = document.querySelectorAll('.nav-btn');
const apiStatus = document.getElementById('api-status');
const apiUrl = document.getElementById('api-url');

// Update API URL display
apiUrl.textContent = API_BASE_URL;

// Navigation
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const sectionId = btn.dataset.section;
        
        // Update active button
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show selected section
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                section.classList.add('active');
                loadSectionData(sectionId);
            }
        });
    });
});

// Load data based on active section
function loadSectionData(sectionId) {
    switch(sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'books':
            loadBooks();
            break;
        case 'members':
            loadMembers();
            break;
        case 'loans':
            loadLoans();
            loadActiveLoans();
            break;
    }
}

// API Health Check - FIXED
async function checkApiHealth() {
    const statusElement = document.getElementById('api-status');
    statusElement.textContent = 'API: Checking...';
    statusElement.className = 'api-status checking';
    
    try {
        // Use /api/books endpoint (which we know works from your test)
        const response = await fetch(`${API_BASE_URL}/books`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.books) {
                statusElement.textContent = 'API: Online';
                statusElement.className = 'api-status online';
                return true;
            }
        }
        throw new Error('Invalid response');
    } catch (error) {
        console.log('API check failed:', error);
        statusElement.textContent = 'API: Offline';
        statusElement.className = 'api-status offline';
        
        // Show helpful message
        if (error.name === 'TypeError') {
            showToast('Cannot connect to backend. Server might be sleeping (first request may take 30-60 seconds).', 'info');
        }
        return false;
    }
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Load Dashboard Data - UPDATED
async function loadDashboard() {
    try {
        const [booksRes, membersRes, loansRes] = await Promise.all([
            fetch(`${API_BASE_URL}/books`),
            fetch(`${API_BASE_URL}/members`),
            fetch(`${API_BASE_URL}/loans`)
        ]);

        const booksData = await booksRes.json();
        const membersData = await membersRes.json();
        const loansData = await loansRes.json();

        const books = booksData.books || booksData || [];
        const members = membersData.members || membersData || [];
        const loans = loansData.loans || loansData || [];

        // Update statistics
        document.getElementById('total-books').textContent = books.length;
        document.getElementById('total-members').textContent = members.length;
        
        const activeLoans = loans.filter(loan => !loan.returnedAt);
        document.getElementById('active-loans').textContent = activeLoans.length;
        
        const overdueLoans = activeLoans.filter(loan => {
            const dueDate = new Date(loan.dueAt);
            return dueDate < new Date();
        });
        document.getElementById('overdue-books').textContent = overdueLoans.length;

        // Load recent activity
        const activityList = document.getElementById('activity-list');
        activityList.innerHTML = '';
        
        const recentLoans = loans.slice(-5).reverse();
        recentLoans.forEach(loan => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div>
                    <strong>${loan.memberId?.name || 'Unknown Member'}</strong> 
                    borrowed "${loan.bookId?.title || 'Unknown Book'}"
                </div>
                <div>${new Date(loan.loanedAt).toLocaleDateString()}</div>
            `;
            activityList.appendChild(activityItem);
        });

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load Books - UPDATED
async function loadBooks() {
    try {
        const response = await fetch(`${API_BASE_URL}/books`);
        const data = await response.json();
        const books = data.books || data || [];
        
        const booksList = document.getElementById('books-list');
        booksList.innerHTML = '';
        
        books.forEach(book => {
            const bookItem = document.createElement('div');
            bookItem.className = 'data-item';
            bookItem.innerHTML = `
                <div class="item-info">
                    <h4>${book.title}</h4>
                    <p><strong>ISBN:</strong> ${book.isbn}</p>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>Copies:</strong> ${book.availableCopies || book.copies}/${book.copies} available</p>
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="openEditModal('book', '${book._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteBook('${book._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            booksList.appendChild(bookItem);
        });

        // Populate book dropdown for loans
        const loanBookSelect = document.getElementById('loan-book');
        loanBookSelect.innerHTML = '<option value="">Select Book</option>';
        books.forEach(book => {
            const availableCopies = book.availableCopies || book.copies;
            if (availableCopies > 0) {
                const option = document.createElement('option');
                option.value = book._id;
                option.textContent = `${book.title} (${book.author}) - ${availableCopies} available`;
                option.dataset.copies = availableCopies;
                loanBookSelect.appendChild(option);
            }
        });

    } catch (error) {
        console.error('Error loading books:', error);
        showToast('Error loading books', 'error');
    }
}

// Add Book
document.getElementById('book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bookData = {
        isbn: document.getElementById('isbn').value.trim(),
        title: document.getElementById('title').value.trim(),
        author: document.getElementById('author').value.trim(),
        copies: parseInt(document.getElementById('copies').value)
    };

    // Validation
    if (!bookData.isbn || !bookData.title || !bookData.author || bookData.copies < 1) {
        showToast('Please fill all fields with valid data', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/books`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookData)
        });

        if (response.ok) {
            showToast('Book added successfully!', 'success');
            document.getElementById('book-form').reset();
            loadBooks();
            loadDashboard();
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to add book', 'error');
        }
    } catch (error) {
        console.error('Error adding book:', error);
        showToast('Error adding book', 'error');
    }
});

// Delete Book
async function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Book deleted successfully!', 'success');
            loadBooks();
            loadDashboard();
            loadLoans();
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to delete book', 'error');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        showToast('Error deleting book', 'error');
    }
}

// Load Members - UPDATED
async function loadMembers() {
    try {
        const response = await fetch(`${API_BASE_URL}/members`);
        const data = await response.json();
        const members = data.members || data || [];
        
        const membersList = document.getElementById('members-list');
        membersList.innerHTML = '';
        
        members.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'data-item';
            memberItem.innerHTML = `
                <div class="item-info">
                    <h4>${member.name}</h4>
                    <p><strong>Email:</strong> ${member.email}</p>
                    <p><strong>Joined:</strong> ${new Date(member.joinedAt).toLocaleDateString()}</p>
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="openEditModal('member', '${member._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteMember('${member._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            membersList.appendChild(memberItem);
        });

        // Populate member dropdown for loans
        const loanMemberSelect = document.getElementById('loan-member');
        loanMemberSelect.innerHTML = '<option value="">Select Member</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member._id;
            option.textContent = `${member.name} (${member.email})`;
            loanMemberSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading members:', error);
        showToast('Error loading members', 'error');
    }
}

// Add Member
document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const memberData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim()
    };

    // Validation
    if (!memberData.name || !memberData.email) {
        showToast('Please fill all fields', 'error');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberData.email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memberData)
        });

        if (response.ok) {
            showToast('Member added successfully!', 'success');
            document.getElementById('member-form').reset();
            loadMembers();
            loadDashboard();
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to add member', 'error');
        }
    } catch (error) {
        console.error('Error adding member:', error);
        showToast('Error adding member', 'error');
    }
});

// Delete Member
async function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/members/${memberId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Member deleted successfully!', 'success');
            loadMembers();
            loadDashboard();
            loadLoans();
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to delete member', 'error');
        }
    } catch (error) {
        console.error('Error deleting member:', error);
        showToast('Error deleting member', 'error');
    }
}

// Load Loans - UPDATED
async function loadLoans() {
    try {
        const response = await fetch(`${API_BASE_URL}/loans`);
        const data = await response.json();
        const loans = data.loans || data || [];
        
        const loansList = document.getElementById('loans-list');
        loansList.innerHTML = '';
        
        // Filter active loans
        const activeLoans = loans.filter(loan => !loan.returnedAt);
        
        activeLoans.forEach(loan => {
            const loanItem = document.createElement('div');
            loanItem.className = 'data-item';
            
            const isOverdue = new Date(loan.dueAt) < new Date();
            if (isOverdue) {
                loanItem.style.borderLeftColor = '#f44336';
            }
            
            loanItem.innerHTML = `
                <div class="item-info">
                    <h4>${loan.bookId?.title || 'Unknown Book'}</h4>
                    <p><strong>Borrowed by:</strong> ${loan.memberId?.name || 'Unknown Member'}</p>
                    <p><strong>Due Date:</strong> ${new Date(loan.dueAt).toLocaleDateString()}</p>
                    ${isOverdue ? '<p style="color: #f44336; font-weight: bold;">OVERDUE</p>' : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-return" onclick="returnBook('${loan._id}')">
                        <i class="fas fa-undo"></i> Return
                    </button>
                </div>
            `;
            loansList.appendChild(loanItem);
        });

    } catch (error) {
        console.error('Error loading loans:', error);
        showToast('Error loading loans', 'error');
    }
}

// Add Loan
document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loanData = {
        memberId: document.getElementById('loan-member').value,
        bookId: document.getElementById('loan-book').value,
        dueAt: document.getElementById('due-date').value
    };

    // Validation
    if (!loanData.memberId || !loanData.bookId || !loanData.dueAt) {
        showToast('Please fill all fields', 'error');
        return;
    }

    // Check if due date is in the future
    const dueDate = new Date(loanData.dueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate <= today) {
        showToast('Due date must be in the future', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/loans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loanData)
        });

        if (response.ok) {
            showToast('Loan created successfully!', 'success');
            document.getElementById('loan-form').reset();
            loadLoans();
            loadDashboard();
            loadBooks(); // Refresh book availability
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to create loan', 'error');
        }
    } catch (error) {
        console.error('Error creating loan:', error);
        showToast('Error creating loan', 'error');
    }
});

// Return Book
async function returnBook(loanId) {
    try {
        const response = await fetch(`${API_BASE_URL}/loans/${loanId}/return`, {
            method: 'PATCH'
        });

        if (response.ok) {
            showToast('Book returned successfully!', 'success');
            loadLoans();
            loadDashboard();
            loadBooks(); // Refresh book availability
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to return book', 'error');
        }
    } catch (error) {
        console.error('Error returning book:', error);
        showToast('Error returning book', 'error');
    }
}

// Load Active Loans for dropdown - UPDATED
async function loadActiveLoans() {
    try {
        const response = await fetch(`${API_BASE_URL}/loans`);
        const data = await response.json();
        const loans = data.loans || data || [];
        
        const activeLoanSelect = document.getElementById('active-loan-select');
        activeLoanSelect.innerHTML = '<option value="">Select Active Loan</option>';
        
        const activeLoans = loans.filter(loan => !loan.returnedAt);
        activeLoans.forEach(loan => {
            const option = document.createElement('option');
            option.value = loan._id;
            option.textContent = `${loan.memberId?.name || 'Unknown'} - ${loan.bookId?.title || 'Unknown'}`;
            activeLoanSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading active loans:', error);
    }
}

// Return Book via dropdown form
document.getElementById('return-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loanId = document.getElementById('active-loan-select').value;
    if (!loanId) {
        showToast('Please select a loan', 'error');
        return;
    }

    await returnBook(loanId);
    loadActiveLoans();
});

// Search functionality
document.getElementById('book-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const books = document.querySelectorAll('#books-list .data-item');
    
    books.forEach(book => {
        const text = book.textContent.toLowerCase();
        book.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
});

document.getElementById('member-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const members = document.querySelectorAll('#members-list .data-item');
    
    members.forEach(member => {
        const text = member.textContent.toLowerCase();
        member.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
});

document.getElementById('loan-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const loans = document.querySelectorAll('#loans-list .data-item');
    
    loans.forEach(loan => {
        const text = loan.textContent.toLowerCase();
        loan.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
});

// Modal functionality
const modal = document.getElementById('edit-modal');
const closeModal = document.querySelector('.close');
const editForm = document.getElementById('edit-form');
const modalTitle = document.getElementById('modal-title');

closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Open edit modal
async function openEditModal(type, id) {
    currentEditType = type;
    currentEditId = id;
    
    try {
        let data;
        if (type === 'book') {
            const response = await fetch(`${API_BASE_URL}/books/${id}`);
            data = await response.json();
            modalTitle.textContent = 'Edit Book';
            
            document.getElementById('edit-form-fields').innerHTML = `
                <input type="text" id="edit-isbn" placeholder="ISBN" value="${data.isbn}" required>
                <input type="text" id="edit-title" placeholder="Title" value="${data.title}" required>
                <input type="text" id="edit-author" placeholder="Author" value="${data.author}" required>
                <input type="number" id="edit-copies" placeholder="Copies" value="${data.copies}" min="1" required>
            `;
        } else if (type === 'member') {
            const response = await fetch(`${API_BASE_URL}/members/${id}`);
            data = await response.json();
            modalTitle.textContent = 'Edit Member';
            
            document.getElementById('edit-form-fields').innerHTML = `
                <input type="text" id="edit-name" placeholder="Name" value="${data.name}" required>
                <input type="email" id="edit-email" placeholder="Email" value="${data.email}" required>
            `;
        }
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading data for edit:', error);
        showToast('Error loading data', 'error');
    }
}

// Handle edit form submission
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let updateData;
    let endpoint;
    
    if (currentEditType === 'book') {
        updateData = {
            isbn: document.getElementById('edit-isbn').value.trim(),
            title: document.getElementById('edit-title').value.trim(),
            author: document.getElementById('edit-author').value.trim(),
            copies: parseInt(document.getElementById('edit-copies').value)
        };
        endpoint = `${API_BASE_URL}/books/${currentEditId}`;
    } else if (currentEditType === 'member') {
        updateData = {
            name: document.getElementById('edit-name').value.trim(),
            email: document.getElementById('edit-email').value.trim()
        };
        endpoint = `${API_BASE_URL}/members/${currentEditId}`;
    }
    
    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            showToast(`${currentEditType.charAt(0).toUpperCase() + currentEditType.slice(1)} updated successfully!`, 'success');
            modal.style.display = 'none';
            
            // Reload the relevant section
            if (currentEditType === 'book') {
                loadBooks();
            } else if (currentEditType === 'member') {
                loadMembers();
            }
            loadDashboard();
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to update', 'error');
        }
    } catch (error) {
        console.error('Error updating:', error);
        showToast('Error updating', 'error');
    }
});

// Initialize the application
async function init() {
    // Check API health
    const isApiOnline = await checkApiHealth();
    
    if (isApiOnline) {
        // Load initial data for dashboard
        loadDashboard();
        
        // Set up auto-refresh for dashboard (every 30 seconds)
        setInterval(() => {
            const activeSection = document.querySelector('.section.active').id;
            if (activeSection === 'dashboard') {
                loadDashboard();
            }
        }, 30000);
    }
}

// Set minimum date for due date input
const today = new Date().toISOString().split('T')[0];
document.getElementById('due-date').min = today;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);