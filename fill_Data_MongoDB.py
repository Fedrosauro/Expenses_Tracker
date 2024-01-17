from pymongo import MongoClient
import random
from datetime import datetime, timedelta

def filldata(db_name, collection_name, data) -> None:
    db = client[db_name]
    db[collection_name].insert_many(data)
    
def printDB(db_name) -> None:
    db = client[db_name]
    collections = db.list_collection_names()
    print(f"Collections in {db_name}: {collections} \n")

    # Iterate over each collection and print its documents
    for collection_name in collections:
        collection = db[collection_name]
        items = collection.find()

        print(f"Items in {collection_name}: \n")
        for item in items:
            print(item)
            
def deleteCollection(db_name, collection_name) -> None:
    db = client[db_name]
    db[collection_name].drop()
    
def deleteUser(db_name, collection_name, username) -> None:
    db = client[db_name]
    collection = db[collection_name]

    # Delete the user based on the username
    result = collection.delete_one({"username": username})

client = MongoClient("mongodb://localhost:27017/")  # Update the connection string as needed

usernames = ["Alice123", "Bob456", "Charlie789", "EvaSmith", "JohnDoe", "SophieM", "Maximus", "Lily123", "AlexW", "EmilyS"]
names = ["Alice", "Bob", "Charlie", "Eva", "John", "Sophie", "Max", "Lily", "Alex", "Emily"]
surnames = ["Smith", "Doe", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez"]

def generate_random_user():
    username = random.choice(usernames)
    usernames.remove(username)  # Remove the selected username to ensure uniqueness
    name = random.choice(names)
    surname = random.choice(surnames)
    password = "12345"
    
    user_data = {
        "username": username,
        "name": name,
        "surname": surname,
        "password": password
    }
    
    return user_data

users_data = [generate_random_user() for _ in range(5)]

#usernames = ["Alice123", "Bob456", "Charlie789", "EvaSmith", "JohnDoe", "SophieM", "Maximus", "Lily123", "AlexW", "EmilyS"]


def generate_random_expense():
    date = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime("%Y-%m")  # Random date within the last year
    description = f"Expense for {date}"
    category = random.choice(["Groceries", "Sport", "Shopping", "Entertainment", "Travel", "Food", "Utilities"])
    total_amount = round(random.uniform(10.0, 200.0), 2)
    
    # Handle refund expenses separately
    if "refund" in description.lower() or category.lower() == "money refund":
        participants = [
            {"username": random.choice(usernames), "share": round(random.uniform(1.0, total_amount), 2)},
            {"username": random.choice(usernames), "share": -round(random.uniform(1.0, total_amount), 2)}
        ]
    else:
        participants = []
        remaining_amount = total_amount
        for i in range(random.randint(2, 5)):
            if i == (len(participants) - 1):
                # Last participant, make sure the remaining amount is assigned to avoid floating-point issues
                share = round(remaining_amount, 2)
            else:
                share = round(random.uniform(1.0, remaining_amount), 2)
            remaining_amount -= share
            participants.append({"username": random.choice(usernames), "share": share})
    
    expense_data = {
        "date": date,
        "description": description,
        "category": category,
        "totalAmount": total_amount,
        "partecipants": participants
    }
    
    return expense_data

#expenses_data = [generate_random_expense() for _ in range(40)]

users_data = [
    {
        "username": "user1", 
        "name": "name1", 
        "surname": "surname1",
        "password": "1234"
    },
    {
        "username": "user2", 
        "name": "name2", 
        "surname": "surname2",
        "password": "1234"
    },
    {
        "username": "user3", 
        "name": "name3", 
        "surname": "surname3",
        "password": "1234"
    },
    {
        "username": "user4", 
        "name": "name4", 
        "surname": "surname4",
        "password": "1234"
    },
]

expenses_data = [
    {
        "date": "2022-05",
        "description": "Made the grocery shop today",
        "category": "Groceries",
        "totalAmount": 20.00,
        "partecipants": [
            {"username": "user4", "share": 15.00},
            {"username": "user1", "share": 5.00},
        ]
    },
    {
        "date": "2023-08",
        "description": "Bowling",
        "category": "Sport",
        "totalAmount": 90.00,
        "partecipants": [
            {"username": "user1", "share": 10.00},
            {"username": "user4", "share": 20.00},
            {"username": "user2", "share": 40.00},
            {"username": "user3", "share": 20.00},
        ]
    },
    {
        "date": "2023-09",
        "description": "Refound from user1 to user4",
        "category": "Money Refound",
        "totalAmount": 0.00,
        "partecipants": [
            {"username": "user1", "share": 5.00},
            {"username": "user4", "share": -5.00}
        ]
    },
            
]

#deleteCollection("mydatabase", "transactions")
#deleteCollection("mydatabase", "users")
#filldata("mydatabase", "users", users_data)
filldata("mydatabase", "expenses", expenses_data)

#deleteUser("mydatabase", "users", "adsfasdf")
# List all databases
databases = client.list_database_names()
print("Databases:", databases)

printDB("mydatabase")
    
# Close the connection
client.close()
