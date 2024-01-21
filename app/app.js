const express = require('express');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const session = require('express-session');
const { query } = require('express-validator');
const uri = "mongodb://mongohost";
const app = express();

const client = new MongoClient(uri);
let db = null;

app.use(express.static(`${__dirname}/public`));
app.use(express.json());
app.use(session({
    secret: 'project_secret',
    resave: false
}));

app.post("/api/auth/signin", async (req, res) => { 
    const user = await db.collection("users").findOne({ username: req.body.username });
    if (user && user.password === req.body.password) {
        req.session.user = user;
        res.status(200).json({ status: 'success', message: 'Login successful' });
    } else {
        res.status(401).json({ status: 'error', message: 'Invalid credentials or user not found' });
    }
});

app.post("/api/auth/signup", async (req, res) => { 
    const existingUser = await db.collection("users").findOne({ username: req.body.username });
    if (existingUser) {
        res.status(409).json({ status: 'error', message: 'Username already taken' });
    } else if (req.body.username !== '' &&
        req.body.name !== '' &&
        req.body.surname !== '' &&
        req.body.passoword !== '') {
        let new_user = {
            username: req.body.username,
            name: req.body.name,
            surname: req.body.surname,
            password: req.body.password,
        };
        await db.collection("users").insertOne(new_user);
        res.status(201).json({ status: 'success', message: 'User created successfully' });
    } else {
        res.status(400).json({ status: 'error', message: 'Invalid fields' });
    }
});

app.get("/api/budget/", checkSignIn, async (req, res) => { 
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();

    res.status(200).json(userExpenses);
});

app.get("/api/budget/search", checkSignIn, query('q').notEmpty().escape(), async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();
    const query = (req.query.q).toLowerCase();

    const filteredExpenses = userExpenses.filter(expense => {
        const description = expense.description.toLowerCase();
        const category = expense.category.toLowerCase();

        return description.includes(query) ||
            category.includes(query) ||
            expense.partecipants.some(participant => participant.username.toLowerCase().includes(query));
    });

    res.json({ expenses: filteredExpenses });
});

app.get("/api/budget/whoami/", checkSignIn, async (req, res) => { 
    const { username, name, surname } = req.session.user;
    res.json({ username, name, surname });
});

app.get("/api/budget/:year", checkSignIn, async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();

    const filteredExpenses = userExpenses.filter(expense => {
        let [yearTr, monthTr] = expense.date.split('-');
        return req.params.year === yearTr;
    });
    res.json({ expenses: filteredExpenses });
});

app.get("/api/budget/:year/:month", checkSignIn, async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();

    const filteredExpenses = userExpenses.filter(expense => {
        let [yearTr, monthTr] = expense.date.split('-');
        return (yearTr === req.params.year && monthTr === req.params.month);
    });
    res.json({ expenses: filteredExpenses });
});

app.get("/api/budget/:year/:month/:id", checkSignIn, async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();

    const filteredExpenses = userExpenses.filter(expense => {
        let [yearTr, monthTr] = expense.date.split('-');
        return (yearTr === req.params.year && monthTr === req.params.month && expense._id.toString() === req.params.id);
    });

    let refounds = null;
    if (filteredExpenses.length !== 0) {
        let [ListOfGivers, ListOfReceivers] = getGiversReceiversLists(filteredExpenses[0]);
        refounds = getRefoundList(ListOfGivers, ListOfReceivers);
    }

    res.json({ expenses: filteredExpenses, refounds: refounds });
});

app.post("/api/budget/:year/:month", checkSignIn, async (req, res) => {
    let newExpense = {
        date: req.params.year + "-" + req.params.month,
        description: req.body.description,
        category: req.body.category,
        totalAmount: req.body.totalAmount,
        partecipants: req.body.partecipants
    }

    await db.collection("expenses").insertOne(newExpense);
    res.json(newExpense);
});

app.delete("/api/budget/:year/:month/:id", checkSignIn, async (req, res) => {
    const expenseObjectId = new ObjectId(req.params.id);

    const result = await db.collection("expenses").deleteOne({
        "_id": expenseObjectId,
        "date": req.params.year + "-" + req.params.month
    });

    if (result.deletedCount === 1) {
        res.status(204).send();
    } else {
        res.status(404).json({ error: "Expense not found" });
    }
});

app.put("/api/budget/:year/:month/:id", checkSignIn, async (req, res) => {
    const expenseObjectId = new ObjectId(req.params.id);
    const { description, category, totalAmount, partecipants } = req.body;

    const result = await db.collection("expenses").updateOne(
        { "_id": expenseObjectId, "date": req.params.year + "-" + req.params.month },
        { $set: { description, category, totalAmount, partecipants } });

    if (result.modifiedCount === 1) {
        res.status(200).json({ message: "Expense updated successfully" });
    } else {
        res.status(404).json({ error: "Expense not found" });
    }
});

app.get("/api/balance/", checkSignIn, async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": req.session.user.username }).toArray();
    let overallBalance = 0;
    let moneySpent = 0;
    let moneyReceived = 0;
    let owedMoney = 0;
    let requestedMoney = 0;

    userExpenses.forEach(expense => {
        const userShare = expense.partecipants.find(participant => participant.username === req.session.user.username).share;
        if (expense.totalAmount === 0) {
            if (userShare < 0) { // we're receiving money
                moneyReceived -= userShare 
                requestedMoney += userShare // it's "+" since we have to lower the requestedMoney and userShare < 0
            } else { // we're refunding someone
                moneySpent -= userShare
                owedMoney -= userShare
            }
        } else {
            moneySpent -= userShare;

            let [ListOfGivers, ListOfReceivers] = getGiversReceiversLists(expense); 
            let refounds = getRefoundList(ListOfGivers, ListOfReceivers); //basically which user has to pay money to other users

            refounds.forEach(refound => {
                if (refound.From === req.session.user.username) {
                    owedMoney += refound.amount
                }
                if (refound.To === req.session.user.username) {
                    requestedMoney += refound.amount
                }
            });
        }
        overallBalance = moneySpent + moneyReceived
    });

    overallBalance = parseFloat(overallBalance.toFixed(2));
    moneySpent = parseFloat(moneySpent.toFixed(2));
    moneyReceived = parseFloat(moneyReceived.toFixed(2));
    owedMoney = parseFloat(owedMoney.toFixed(2));
    requestedMoney = parseFloat(requestedMoney.toFixed(2));

    res.json({ overallBalance, moneySpent, moneyReceived, owedMoney, requestedMoney });
});

app.get("/api/balance/:id", checkSignIn, async (req, res) => {
    const userExpenses = await db.collection("expenses").find({ "partecipants.username": { $all: [req.session.user.username, req.params.id] } }).toArray();
    let overallBalance = 0;
    let moneySpent = 0;
    let moneyReceived = 0;
    let owedMoney = 0;
    let requestedMoney = 0;

    userExpenses.forEach(expense => {
        const userShare = expense.partecipants.find(participant => participant.username === req.session.user.username).share;
        if (expense.totalAmount === 0) {
            if (userShare < 0) {
                moneyReceived -= userShare 
                requestedMoney += userShare
            } else {
                moneySpent -= userShare
                if (req.params.id !== req.session.user.username) owedMoney -= userShare //case for which user does not search himself
            }
        } else {
            moneySpent -= userShare;

            let [ListOfGivers, ListOfReceivers] = getGiversReceiversLists(expense);
            let refounds = getRefoundList(ListOfGivers, ListOfReceivers);

            refounds.forEach(refound => {
                if (refound.From === req.session.user.username && refound.To === req.params.id) {
                    owedMoney += refound.amount
                }
                if (refound.From === req.params.id && refound.To === req.session.user.username) {
                    requestedMoney += refound.amount
                }
            });
        }
        overallBalance = moneySpent + moneyReceived
    });

    overallBalance = parseFloat(overallBalance.toFixed(2));
    moneySpent = parseFloat(moneySpent.toFixed(2));
    moneyReceived = parseFloat(moneyReceived.toFixed(2));
    owedMoney = parseFloat(owedMoney.toFixed(2));
    requestedMoney = parseFloat(requestedMoney.toFixed(2));

    res.json({ overallBalance, moneySpent, moneyReceived, owedMoney, requestedMoney });
});

function getGiversReceiversLists(expense) {
    const ListOfGivers = [];
    const ListOfReceivers = [];

    expense.partecipants.forEach(partecipant => {
        const username = partecipant.username;
        const owedAmount = (expense.totalAmount / expense.partecipants.length) - partecipant.share;

        if (owedAmount > 0) {
            ListOfGivers.push({ username, give: owedAmount });
        } else if (owedAmount < 0) {
            ListOfReceivers.push({ username, receive: -owedAmount });
        }
    });
    return [ListOfGivers, ListOfReceivers];
}

function getRefoundList(ListG, listR) { //starting from each user in the Givers List, we fill each user in the Receivers List
    let refounds = [];
    for (let j = 0; j < (listR.length); j++) {
        for (let i = 0; i < (ListG.length) && listR[j].receive !== 0; i++) {
            if (ListG[i].give !== 0) {
                let moneyGiven;
                if (listR[j].receive - ListG[i].give > 0) {
                    moneyGiven = ListG[i].give;
                    listR[j].receive -= ListG[i].give;
                    ListG[i].give = 0;
                } else {
                    moneyGiven = listR[j].receive;
                    ListG[i].give -= listR[j].receive;
                    listR[j].receive = 0;
                }
                moneyGiven = parseFloat(moneyGiven.toFixed(2));
                refounds.push({ "From": ListG[i].username, "To": listR[j].username, "amount": moneyGiven });
            }
        }
    }
    return refounds;
}

app.get("/api/users/search", query('q').notEmpty().escape(), checkSignIn, async (req, res) => {
    const matchingUsers = await db.collection("users").find({ "username": query }).toArray();

    if (matchingUsers.length > 0) {
        return res.status(200).send();
    } else {
        return res.status(404).send();
    }
});

app.get("/api/users/", checkSignIn, async (req, res) => { 
    const users = await db.collection("users").distinct("username");

    res.status(200).json(users);
});

app.get("/api/logout/", checkSignIn, async (req, res) => { 
    req.session.user = null;
    res.status(200).send();
});

function checkSignIn(req, res, next) {
    if (req.session.user) { return next() }
    res.status(403).json({ error: 'Cannot access this page' });
}

app.listen(3000, async () => {
    await client.connect();
    db = client.db("mydatabase");
});