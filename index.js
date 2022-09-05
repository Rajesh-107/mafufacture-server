const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1u7kw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {
    try{
        await client.connect();
        // console.log('Database connected')
        const bikePartCollection = client.db('manufacture').collection('products');
        const orderCollection = client.db("manufacture").collection("orders");
        const reviewCollection = client.db("manufacture").collection("reviews");
        const userCollection = client.db("manufacture").collection("users");
       

        app.get('/bikeparts', async(req, res) => {
            const query = {};
            const cursor = bikePartCollection.find(query);
            const bikeParts = await cursor.toArray();
            res.send(bikeParts);
        });

        app.get('/purchase/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const bikepart = await bikePartCollection.findOne(query);
            res.send(bikepart);

        })
         app.post('/order', async(req, res) => {
            const order = req.body;
            const query = {order: order.product, order: order.price,order: order.quantity,order: order.email,order: order.phone,}
            const exists = await orderCollection.findOne(query)
            if(exists){
                return res.send({success: false, order:exists})
            }
            const result = await orderCollection.insertOne(order);
            return res.send({success: true, result});
        })
      
        app.get('/order', async(req, res) => {
            const email = req.query.email;
            
            const query = {email: email};
            const Myorders = await orderCollection.find(query).toArray();
            res.send(Myorders);
        })
        
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }

            const result = await userCollection.findOne(filter);
            res.send(result);
        })

        // update an user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const updatedUser = req.body;
            const filter = { email: email };
            const options = {upsert:true}
            const updatedDoc = {
                $set: {
                    updatedUser,
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN, {expiresIn: '2h'})
            res.send({result, token});
        })


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello vai manufacture')
})
app.listen(port, () => {
    console.log(`Manufacture app listening on port ${port}`)
})