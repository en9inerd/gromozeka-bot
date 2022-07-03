mongo -- "$MONGO_INITDB_DATABASE" <<EOF
    use admin;
    db.getSiblingDB('$MONGO_INITDB_DATABASE');
    use $MONGO_INITDB_DATABASE;
    db.createUser(
        {
            user: '$MONGO_DB_USERNAME',
            pwd: '$MONGO_DB_PASSWORD',
            roles: [
                {
                    role: "readWrite",
                    db: '$MONGO_INITDB_DATABASE'
                }
            ]
        }
    );
EOF
