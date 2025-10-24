# External MongoDB Deployment

DiagramHub deployment using an external MongoDB instance (MongoDB Atlas, AWS DocumentDB, custom server, etc.)

## Services Included

- **Backend** - FastAPI application
- **Frontend** - React + Vite application
- ❌ **MongoDB** - Expected to be hosted externally

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2
- External MongoDB instance with connection URI

## Supported MongoDB Services

### MongoDB Atlas (Recommended)

Free tier available: https://www.mongodb.com/cloud/atlas/register

Connection string format:
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### AWS DocumentDB

Connection string format:
```
mongodb://username:password@cluster.region.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=rds-combined-ca-bundle.pem
```

### Azure Cosmos DB (MongoDB API)

Connection string format:
```
mongodb://username:password@account.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb
```

### Custom MongoDB Server

Standard connection format:
```
mongodb://username:password@host:27017/database
```

## Quick Start

1. **Set up external MongoDB:**

   - Create a MongoDB instance (Atlas, AWS, etc.)
   - Create a database (e.g., `diagramahub`)
   - Create a user with read/write permissions
   - Whitelist your IP address (if using Atlas)
   - Get the connection URI

2. **Configure environment variables:**

   Create `backend/.env` in the project root:
   ```bash
   MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/
   DATABASE_NAME=diagramahub
   JWT_SECRET=<generate-secure-secret>
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   API_V1_PREFIX=/api/v1
   ```

   Generate a secure JWT secret:
   ```bash
   openssl rand -base64 32
   ```

3. **Test MongoDB connection** (optional but recommended):

   ```bash
   # Using mongosh
   mongosh "mongodb+srv://user:password@cluster.mongodb.net/diagramahub"

   # Test with Docker
   docker run --rm mongo:8 mongosh "your-connection-string" --eval "db.adminCommand('ping')"
   ```

4. **Start services:**
   ```bash
   cd deploy/external-mongodb
   docker-compose up -d
   ```

5. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

6. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5172
   - API Docs: http://localhost:5172/docs

## MongoDB Atlas Setup Guide

### 1. Create Free Cluster

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create an account
3. Choose "Shared" (Free tier)
4. Select a cloud provider and region
5. Create cluster

### 2. Create Database User

1. In Atlas, go to "Database Access"
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Set username and password
5. Grant "Read and write to any database"
6. Add user

### 3. Configure Network Access

1. Go to "Network Access"
2. Click "Add IP Address"
3. Options:
   - **Allow access from anywhere:** `0.0.0.0/0` (less secure, easier for testing)
   - **Add current IP:** Use your current IP (more secure)
4. Confirm

### 4. Get Connection String

1. Go to "Database" → "Connect"
2. Choose "Connect your application"
3. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your credentials
5. Add database name before `?`:
   ```
   mongodb+srv://user:pass@cluster.mongodb.net/diagramahub?retryWrites=true&w=majority
   ```

## Common Operations

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

## Data Management

### Backup

Since MongoDB is external, use your provider's backup solution:

**MongoDB Atlas:**
- Automatic backups enabled by default
- Manual snapshots available
- Point-in-time recovery (paid tiers)

**Manual backup with mongodump:**
```bash
mongodump --uri="your-connection-string" --out=./backup
```

### Restore

**Using mongorestore:**
```bash
mongorestore --uri="your-connection-string" ./backup
```

## Troubleshooting

### Backend can't connect to MongoDB

1. **Test connection string:**
   ```bash
   mongosh "your-connection-string"
   ```

2. **Common issues:**
   - ❌ Wrong username/password
   - ❌ IP not whitelisted (Atlas)
   - ❌ Network firewall blocking connection
   - ❌ Invalid connection string format
   - ❌ Database name not specified

3. **Check backend logs:**
   ```bash
   docker-compose logs backend
   ```

4. **Verify `.env` file:**
   ```bash
   cat ../../backend/.env
   ```

### Connection timeout

- **Atlas**: Whitelist your IP in Network Access
- **Firewall**: Ensure outbound connections to MongoDB ports are allowed
- **VPN**: May interfere with connections, try without VPN

### Authentication failed

- Verify username and password are correct
- Check user has proper database permissions
- Ensure password doesn't contain special characters that need URL encoding

### SSL/TLS errors

For AWS DocumentDB or custom servers requiring SSL:

1. Download CA certificate
2. Add to backend container
3. Update connection string to include `ssl=true`

## Security Best Practices

### 1. Connection String Security

✅ **DO:**
- Store connection string in `.env` file
- Use strong passwords (20+ characters)
- Never commit `.env` to version control
- Use different credentials for dev/staging/prod

❌ **DON'T:**
- Hardcode connection strings in code
- Share credentials in chat/email
- Use weak passwords
- Reuse passwords across environments

### 2. MongoDB Atlas Security

- Enable IP whitelist (don't use 0.0.0.0/0 in production)
- Use MongoDB Atlas' built-in encryption
- Enable audit logs (paid tiers)
- Set up monitoring and alerts
- Use Private Endpoints for production (paid tiers)

### 3. Network Security

- Use TLS/SSL for connections
- Place backend in private subnet (cloud deployments)
- Use VPC peering (Atlas M10+ clusters)
- Enable MongoDB authentication

## Production Deployment

For production environments:

1. **Use production-grade MongoDB:**
   - MongoDB Atlas M10+ cluster (with backups, monitoring)
   - AWS DocumentDB (managed)
   - Azure Cosmos DB with MongoDB API

2. **Enable monitoring:**
   - Set up Atlas monitoring and alerts
   - Use application performance monitoring (APM)
   - Configure log aggregation

3. **Implement proper backup strategy:**
   - Automated daily backups
   - Test restore procedures
   - Store backups in different region

4. **Use secrets management:**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Kubernetes Secrets

5. **Configure autoscaling:**
   - Atlas cluster autoscaling
   - Kubernetes HPA for backend

## Cost Optimization

### MongoDB Atlas Free Tier Limits

- **Storage:** 512 MB
- **RAM:** Shared
- **vCPU:** Shared
- **Backups:** Not included
- **Max connections:** Limited

### When to Upgrade

Consider paid tiers when:
- Storage > 500 MB
- Need dedicated resources
- Require backups/point-in-time recovery
- Need VPC peering
- Require 24/7 support

### Alternative Free Options

- **Railway.app** - Free MongoDB hosting
- **Render.com** - Free tier available
- **MongoDB Community Edition** - Self-hosted on VPS

## Migration from Local to External MongoDB

If migrating from local-full deployment:

1. **Export data from local MongoDB:**
   ```bash
   docker exec diagramahub-mongodb mongodump --out=/dump
   docker cp diagramahub-mongodb:/dump ./local-backup
   ```

2. **Import to external MongoDB:**
   ```bash
   mongorestore --uri="your-external-connection-string" ./local-backup
   ```

3. **Update configuration:**
   ```bash
   # Update backend/.env
   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/diagramahub

   # Switch to external-mongodb deployment
   rm ../../docker-compose.yml
   ln -sf deploy/external-mongodb/docker-compose.yml ../../docker-compose.yml
   ```

4. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

5. **Verify migration:**
   - Test login functionality
   - Verify data is accessible
   - Check backend logs for errors
