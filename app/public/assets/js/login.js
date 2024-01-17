const { createApp } = Vue

const login = createApp({
    data() {
        return {
            showSignInSection: true,
            error: '',
            username: '',
            password: '',
            repeatPassword: '',
            name: '',
            surname: '',
        };
    },
    methods: {
        async signIn() {
            const user = {
                username: this.username,
                password: this.password,
            };

            const response = await fetch("/api/auth/signin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(user),
            });

            if (response.ok) {
                window.location.replace("dashboard.html");
            } else {
                this.error = 'Username or password are not correct';
            }
        },
        async signUp() {
            if (this.password !== this.repeatPassword) {
                this.error = 'Passwords are different';
            } else {
                const newUser = {
                    username: this.username,
                    name: this.name,
                    surname: this.surname,
                    password: this.password,
                };

                const response = await fetch("/api/auth/signup", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(newUser),
                });

                if (response.ok) {
                    this.showSignInSection = true;
                    this.resetValues();
                } else if (response.status === 409) {
                    this.error = 'Username is already taken';
                } else if (response.status === 400) {
                    this.error = 'One or more fields are not valid';
                }
            }
        },
        resetValues() {
            this.error = '';
            this.username = '';
            this.password = '';
            this.repeatPassword = '';
            this.name = '';
            this.surname = '';
        }
    },
}).mount("#login");

