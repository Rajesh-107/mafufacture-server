const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_KEY);

// middleware

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1u7kw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'unauthorized access'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden access'});
        }
        console.log('decoded', decoded);
        req.decoded = decoded;
        next();
    })  
  }


async function run() {
    try{
        await client.connect();
        // console.log('Database connected')
        const bikePartCollection = client.db('manufacture').collection('products');
        const orderCollection = client.db("manufacture").collection("orders");
        const reviewCollection = client.db("manufacture").collection("reviews");
        const userCollection = client.db("manufacture").collection("users");
        const paymentCollection = client.db('manufacture').collection('payments');
       

        const verifyAdmin = async(req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send({ message: 'forbidden' });
            }

        }
        //payment intend
        app.post('/create-payment-intent', async(req, res) => {
            const order = req.body;
            const price = order.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })
        ;

        //add Product
        app.post('/inventory', async(req, res) => {
            const newItem = req.body;
            const result = await bikePartCollection.insertOne(newItem);
            res.send(result);
        });


       
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);

        })


        app.get('/bikeparts', async(req, res) => {
            const query = {};
            const cursor = bikePartCollection.find(query);
            const bikeParts = await cursor.toArray();
            res.send(bikeParts);
        });

        //delete
        app.delete('/bikeparts/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bikePartCollection.deleteOne(query);
            res.send(result);
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
            return res.send(Myorders);
           
        });

        app.get("/allorder", async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
          });


        //payment collection
        app.get('/order/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const order = await orderCollection.findOne(query);
            res.send(order)
        });


        
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

        //delete user
        // app.delete('/users/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: ObjectId(id) };

        //     const result = await orderCollection.deleteOne(query);
        //     res.send(result);
        // })


        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }

            const result = await userCollection.findOne(filter);
            res.send(result);
        });

        app.get('/admin/:email', async(req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        //admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            
            const filter = { email: email };
            const updatedDoc = {
                $set: {role:'admin'}
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // update an user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = {upsert:true}
            const updatedDoc = {
                $set: user,
                
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