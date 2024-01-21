const { createApp } = Vue

const dashboard = createApp({
    data() {
        return {
            expenses: [],
            showBudgetsSection: true,
            showModifySection: false,
            showAddSection: false,
            showAboutMeSection: false,
            showBalanceSection: false,
            showForbiddenSection: false,
            showSpecificExpense: false,
            balance: null,
            allUsernames: [],
            searchOption: 'Query',
            id: '',
            query: '',
            year: '',
            month: '',
            descr: '',
            categ: '',
            totAm: '',
            partec: [],
            selectedExpense: null,
            selectedExpenseId: '',
            newUsername: '',
            newShare: '',
            error: '',
            addSectionNumber: 0,
            showFinishButton: false,
            currentUser: null,
        };
    },
    methods: {
        async getExpenses() {  
            const response = await fetch("/api/budget/");

            if (response.ok) {
                this.expenses = await response.json();
            } else {
                this.showForbiddenSection = true;
            }
        },
        async getBalanceSection() {
            this.newUsername = '';
            [this.balance, this.allUsernames] = await Promise.all([
                fetch("/api/balance/").then(response => response.json()),
                fetch("/api/users/").then(response => response.json())
            ]);

            this.showSpecificExpense = false;
            this.showModifySection = false;
            this.showAddSection = false;
            this.showBudgetsSection = false;
            this.showAboutMeSection = false;
            this.showBalanceSection = true;
        },
        async updateBalance() {
            this.error = ''
            let response = await fetch("/api/users/search?q=" + this.newUsername);
            if (response.ok) {
                this.balance = await fetch("/api/balance/" + this.newUsername).then(response => response.json());
                if (this.balance.owedMoney >= this.balance.requestedMoney) {
                    this.balance.owedMoney -= this.balance.requestedMoney;
                    this.balance.owedMoney = parseFloat(this.balance.owedMoney.toFixed(2));
                    this.balance.requestedMoney = 0;
                } else{
                    this.balance.requestedMoney -= this.balance.owedMoney;
                    this.balance.requestedMoney = parseFloat(this.balance.requestedMoney.toFixed(2));
                    this.balance.owedMoney = 0;
                }
            } else {
                this.error = 'User does not exist';
            }
        },
        async getAboutMeSection() { 
            this.showSpecificExpense = false;
            this.showModifySection = false;
            this.showAddSection = false;
            this.showBudgetsSection = false;
            this.showBalanceSection = false;
            this.showAboutMeSection = true;
        },
        async performLogout() { 
            if (await fetch("/api/logout/").then(response => response.ok)) {
                location.reload();
                window.location.replace("index.html");
            }
        },
        shouldShowInput(options) { 
            return options.includes(this.searchOption);
        },
        async filterExpenses() { 
            let response = '';
            if (this.searchOption === 'Query' && this.query !== '') {
                response = await fetch("/api/budget/search?q=" + this.query);
            } else if (this.searchOption === 'Year' && this.year !== '') {
                response = await fetch("/api/budget/" + this.year);
            } else if (this.searchOption === 'Year-Month' && this.year !== '' && this.month !== '') {
                response = await fetch("/api/budget/" + this.year + "/" + this.month);
            } else if (this.searchOption === 'Year-Month-ID' && this.year !== '' && this.month !== '' && this.id !== '') {
                response = await fetch("/api/budget/" + this.year + "/" + this.month + "/" + this.id);
            }

            this.expenses = (await response.json()).expenses;
        },
        isSelected(expenseId) {
            return this.selectedExpenseId === expenseId;
        },
        toggleExpenseId(expenseId) {
            this.selectedExpenseId = this.selectedExpenseId === expenseId ? '' : expenseId;
        },
        async modifyExpense(expenseId, expenseDate) {
            let [year, month] = expenseDate.split('-');
            const urlPattern = "/api/budget/" + year + "/" + month + "/" + expenseId;

            [this.selectedExpense, this.allUsernames] = await Promise.all([
                fetch(urlPattern).then(response => response.json()),
                fetch("/api/users/").then(response => response.json())
            ]);

            const { description, category, totalAmount, partecipants } = this.selectedExpense.expenses[0];
            this.descr = description;
            this.categ = category;
            this.totAm = totalAmount;
            this.partec = partecipants;

            this.showBudgetsSection = false;
            this.showModifySection = true;
        },
        selectSuggestion(suggestion) {
            this.newUsername = suggestion;
        },
        async addPartecipant() {
            this.error = '';
            let response = await fetch("/api/users/search?q=" + this.newUsername);

            const usernameAlreadyPresent = this.partec.some(partecipant => partecipant.username === this.newUsername);
            if (!response.ok) {
                this.error = 'Username does not exists'
            } else if (usernameAlreadyPresent) {
                this.error = 'Username is already present';
            } else if (!(/^(-?\d+(\.\d+)?)$/).test(this.newShare)) {
                this.error = 'Share is not a valid number';
            } else {
                let newUser = { username: this.newUsername, share: parseFloat(this.newShare) };
                this.partec.push(newUser);
                this.newUsername = '';
                this.newShare = '';
            }
        },
        removePartecipant(index) {
            this.error = '';
            this.partec.splice(index, 1);
        },
        async completeModification() {
            this.error = this.checkFields();
            if (this.error === '') {
                let [year, month] = this.selectedExpense.expenses[0].date.split('-');
                const urlPattern = "/api/budget/" + year + "/" + month + "/" + this.selectedExpense.expenses[0]._id;
                const modifiedExpense = { description: this.descr, category: this.categ, totalAmount: this.totAm, partecipants: this.partec };

                await fetch(urlPattern, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(modifiedExpense),
                });

                await this.resetEverything();
            }
        },
        checkFields() {
            let tolerance = 1e-8;
            let sumOfShares = this.partec.reduce((total, partecipant) => total + partecipant.share, 0);
            if (this.descr === '') return "Description can't be empty";
            else if (this.categ === '') return "Category can't be empty";
            else if (Math.abs(parseFloat(this.totAm) - sumOfShares) > tolerance) return "Sum of shares is different from total";
            else if (isNaN(parseFloat(this.totAm))) return "Total Amount is not a valid number";
            else return '';
        },
        async deleteExpense(expenseId, expenseDate) {
            let [year, month] = expenseDate.split('-');
            const urlPattern = "/api/budget/" + year + "/" + month + "/" + expenseId;

            await fetch(urlPattern, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            await this.getExpenses();
        },
        addNewExpense() {
            this.showBudgetsSection = false;
            this.showAddSection = true;
        },
        async changeField(step) {
            this.error = '';
            if (step === 1) {
                if (this.addSectionNumber === 0 && !(/^[1-9]\d*$/).test(this.year)) {
                    this.error = 'Year inserted is not valid';
                } else if (this.addSectionNumber === 1 && (parseInt(this.month) < 1 || parseInt(this.month) > 12 || !(/^[1-9]\d*$/).test(this.month))) {
                    this.error = 'Month must be a number between 1 and 12';
                } else if (this.addSectionNumber === 2 && this.descr === '') {
                    this.error = "Description can't be empty";
                } else if (this.addSectionNumber === 3 && this.categ === '') {
                    this.error = "Category can't be empty";
                } else if (this.addSectionNumber === 4 && (this.totAm === '' || isNaN(parseFloat(this.totAm)) || parseFloat(this.totAm) < 0)) {
                    this.error = "Total Amount can't be empty or < 0";
                }
            }

            if (this.error === '') {
                this.addSectionNumber += step;
                this.addSectionNumber = this.addSectionNumber === -1 ? 0 : this.addSectionNumber;
                this.showFinishButton = this.addSectionNumber === 6;

                if (this.addSectionNumber === 5) {
                    let loggedUser = await fetch("/api/budget/whoami").then(response => response.json());
                    let newUser = { username: loggedUser.username, share: parseFloat(this.totAm) };
                    this.allUsernames = await fetch("/api/users/").then(response => response.json());

                    if (this.partec.length === 0) this.partec.push(newUser)
                }
            }
        },
        async completeAddition() {
            let tolerance = 1e-8;
            if (this.addSectionNumber === 5) {
                let sumOfShares = this.partec.reduce((total, partecipant) => total + partecipant.share, 0);
                if (Math.abs(parseFloat(this.totAm) - sumOfShares) > tolerance) {
                    this.error = 'Sum of shares is different from total';
                }
            }

            if (this.error === '') {
                const urlPattern = "/api/budget/" + this.year + "/" + ((parseInt(this.month) > 9) ? "" : "0") + this.month;
                const newExpense = { description: this.descr, category: this.categ, totalAmount: parseFloat(this.totAm), partecipants: this.partec };

                await fetch(urlPattern, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newExpense),
                });

                await this.resetEverything();
            }
        },
        async openExpense(expenseId, expenseDate) {
            let [year, month] = expenseDate.split('-');
            const urlPattern = "/api/budget/" + year + "/" + month + "/" + expenseId;

            this.selectedExpense = await fetch(urlPattern).then(response => response.json());

            this.showBudgetsSection = false;
            this.showSpecificExpense = true;
        },
        async resetEverything() {
            await this.getExpenses();
            this.showBudgetsSection = true;
            this.showModifySection = false;
            this.showAddSection = false;
            this.showAboutMeSection = false;
            this.showBalanceSection = false;
            this.showSpecificExpense = false;
            this.balance = null;
            this.allUsernames = [];
            this.searchOption = 'Query';
            this.id = '';
            this.query = '';
            this.year = '';
            this.month = '';
            this.descr = '';
            this.categ = '';
            this.totAm = '';
            this.partec = [];
            this.selectedExpense = null;
            this.selectedExpenseId = '';
            this.newUsername = '';
            this.newShare = '';
            this.error = '';
            this.addSectionNumber = 0;
            this.showFinishButton = false;
        },
        async resetSearchValues() { 
            await this.getExpenses();
            this.query = '';
            this.year = '';
            this.month = '';
            this.id = '';
        },
    },
    computed: {
        filteredUsernames() {
            const input = this.newUsername.toLowerCase();
            return this.allUsernames.filter(username => username.toLowerCase().includes(input));
        }
    },
    mounted: async function () {
        this.currentUser = await fetch("/api/budget/whoami/").then(response => response.json());
        await this.getExpenses();
    },
}).mount("#dashboard");