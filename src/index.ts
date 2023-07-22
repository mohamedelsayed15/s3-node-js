import express from "express"
import multer from "multer"
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import dotenv from "dotenv"
import crypto from 'crypto'
import sharp from 'sharp'
dotenv.config()

const app = express()

// configuration of s3
// create instance of s3Client class
const s3 = new S3Client({
    credentials: {
        // access key id
        secretAccessKey: process.env.SECRET_ACCESS_KEY!,
        // secret of the access key
        accessKeyId: process.env.ACCESS_KEY!
    },
    region: process.env.AWS_REGION // aws region of the bucket
})

// configuration of storage for multer memory storage
const storage = multer.memoryStorage()

//file filter for multer
const fileFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.match(/\.(jpg|png|gif|jpeg)$/)) {
        return cb(null, false) //reject
    }
    cb(null, true)//accept
}

//multer configuration
const upload = multer({
    storage,
    fileFilter
})

const randomImageName = (originalImageName: string): Promise<string> => {

    const fileName = originalImageName.split(".")[0]

    const bytes = 32
    // turning callback into promise
    return new Promise((resolve, reject) => {
        crypto.randomBytes(bytes, (err, buffer) => {
            if (err) {
                reject(err)
            }
            resolve(fileName + "-" + buffer.toString('hex'))
        })
    })

}

// putting an image on the bucket
// note that if 2 images with the same name
// second one will replace the first
interface s3PutParams{
    Bucket: string
    Key: string
    Body: Buffer
    ContentType:string
}
app.put('/putImage', upload.single("image"), async (req: any, res: any) => {
    try { 

        //console.log(req.body)
        //console.log(req.file)
        //custom function generates random string

        // store into database so you can retrieve the image from s3
        const imageName: string = await randomImageName(req.file.originalname)
        //for image retrieval
        console.log(imageName)

        const buffer = await sharp(req.file.buffer)
            .resize({
                height: 500,
                width: 450,
                fit: "contain"
            })
            .toBuffer()

        // constructor options for PutObjectCommand class
        const params:s3PutParams = {
            Bucket: process.env.BUCKET_NAME!,
            Key: imageName,
            Body: buffer,
            ContentType : req.file.mimetype
        }

        // create instance of putObjectCommand class
        const command = new PutObjectCommand(params)

        // using .send() sending the instance of the put object

        await s3.send(command)

        res.send({ imageName })

    } catch (e) {
        console.log(e)
        res.status(500).send()
    }
})

app.get('/getImageUrl/:imageName', async(req, res) => {
    try {
        const imageName = req.params.imageName

        // options for the constructor
        const params = {
            Bucket: process.env.BUCKET_NAME!,
            Key:imageName
        }
        // creating an instance
        const command = new GetObjectCommand(params)

        // creating a url that expires in 1 hour for the image
        const url = await getSignedUrl(
            s3,
            command,
            { expiresIn: 3600 }
        )

        res.send({ imageUrl: url })
        

    } catch (e) {
        res.status(500).send()
    }
})

app.delete('/deleteImage/:imageName', async(req, res) => {
    try {
        const imageName = req.params.imageName

        // options for the constructor
        const params = {
            Bucket: process.env.BUCKET_NAME!,
            Key:imageName
        }
        // creating an instance
        const command = new DeleteObjectCommand(params)

        await s3.send(command)

        res.send()

    } catch (e) {
        res.status(500).send()
    }
})

app.listen(8080, () => {
    console.log("listening")
})