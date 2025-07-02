const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'db.snrnmwvtzknevgmghvoc.supabase.co',
  database: 'postgres',
  password: 'koke123', // copia aquí tu password de Supabase
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});




app.post('/usuarios',async(req,res)=>{
  const{nombre,contra,correo, rol,sucursal} =req.body;

  try{
    await pool.query(
      'INSERT INTO usuarios (nombre,contra,correo,rol,tienda) VALUES ($1,$2,$3,$4,$5)',[nombre,contra,correo,rol,sucursal]
    );
    res.json({ok:true});

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


const jwt = require('jsonwebtoken');
const SECRET_KEY = 'token1'; // o usa process.env.SECRET_KEY

app.post('/login', async (req, res) => {
  const { correo, pass } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, rol,tienda FROM usuarios WHERE correo = $1 AND contra = $2',
      [correo, pass]
    );

    if (result.rows.length > 0) {
      const { id, rol,tienda } = result.rows[0];

      // Datos que deseas incluir en el token
      const payload = { id, correo, rol,tienda };
      console.log('Payload para token:', payload);

      // Generar token con expiración de 1 hora
      const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

      res.json({ valido: true, id, rol, token,tienda });
    } else {
      res.json({ valido: false });
    }
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ error: err.message });
  }
});




app.post('/sprod', async (req,res)=>{
  const {nombre, categoria, precio, descripcion,imagen} =req.body;
  try{
    const result =await pool.query('INSERT INTO productos (nombre,categoria,precio,descripcion,imagen) VALUES ($1,$2,$3,$4,$5)',
      [nombre, categoria, precio, descripcion,imagen]
    );
    res.json({ok:true});
  }catch(err){
    res.status(500).json({error:err.message});
  };
});


app.get('/obproductos', async(req,res)=>{
  try{
    const result = await pool.query('SELECT * FROM productos');
    res.json(result.rows);
  }catch(err){
    res.status(500).json({error:err.message});
  }
});

app.get('/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    const result2= await pool.query('SELECT tienda FROM protiendas where idproducto=$1 GROUP BY tienda',[id]);

    if (result.rows.length > 0) {
      res.json({
        productoo: result.rows[0],
        tiendas: result2.rows.map(row=>row.tienda)
      })
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/comentarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM comentarios WHERE idproducto = $1',
      [id] 
    );
    res.json(result.rows); // Siempre regresa lista, aunque esté vacía
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/subirComentario/:id',async(req,res)=>{
  const {id}=req.params;
  const {com}=req.body;
  console.log('Comentario recibido:', req.body.com);

  try{
    const result = await pool.query('INSERT INTO comentarios (idproducto, comentario) VALUES ($1,$2)',[id,com]);
    res.json({ok:true});
  }catch(err){
    res.status(500).json({error:err.message});
  }
})


//Productos subidos en cada tienda--------------------------------------------

app.post('/anadirProductoATienda', async (req, res) => {
  const { idproducto, idtienda, tienda } = req.body;

  try {
    // Validar si ya existe en la tienda
    const yaExiste = await pool.query(
      'SELECT * FROM protiendas WHERE idproducto = $1 AND idtienda = $2',
      [idproducto, idtienda]
    );

    if (yaExiste.rows.length > 0) {
      return res.status(400).json({ error: 'Producto ya registrado en esta tienda' });
    } else {
      // Obtener datos del producto original
      const producto = await pool.query(
        'SELECT nombre, precio, descripcion FROM productos WHERE id = $1',
        [idproducto]
      );

      if (producto.rows.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      const { nombre, precio, descripcion } = producto.rows[0];

      await pool.query(
        'INSERT INTO protiendas (nombre, precio, descripcion, idtienda, idproducto,tienda) VALUES ($1, $2, $3, $4, $5,$6)',
        [nombre, precio, descripcion, idtienda, idproducto,tienda]
      );

      res.json({ ok: true });
    }
  } catch (err) {
    console.error('Error en /anadirProductoATienda:', err);
    res.status(500).json({ error: err.message });
  }
});





//-------------------|||||||||||||PEDIDOS||||||||||||||||------------------------------------------------

app.post('/ordenar', async (req, res) => {
  const pedidos = req.body; // { [tienda]: { folio, productos: [...] } }

  try {
    for (const tienda in pedidos) {
      const pedido = pedidos[tienda];
      const { folio, productos } = pedido;

      // Obtener fecha y hora actuales
      const now = new Date();
      const fecha = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hora = now.toTimeString().split(' ')[0]; // HH:MM:SS

      // Insertar pedido
      const result = await pool.query(
        'INSERT INTO pedidos (folio, fecha, hora, tienda) VALUES ($1, $2, $3, $4) RETURNING id',
        [folio, fecha, hora, tienda]
      );
      const id_pedido = result.rows[0].id;

      // Insertar productos
      for (const prod of productos) {
        await pool.query(
          'INSERT INTO detalles_pedido (id_pedido, idproducto, nombre, precio) VALUES ($1, $2, $3, $4)',
          [id_pedido, prod.id, prod.nombre, prod.precio]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error al guardar pedido:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/eliminarProductoTienda/:idproducto/:idtienda', async (req, res) => {
  const { idproducto, idtienda } = req.params;

  try {
    await pool.query(
      'DELETE FROM protiendas WHERE idproducto = $1 AND idtienda = $2',
      [idproducto, idtienda]
    );
    res.json({ ok: true });
    console.log('Eliminando producto', idproducto, 'de tienda', idtienda);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Obtener pedidos por tienda
app.get('/pedidos/:idtienda', async (req, res) => {
  const { idtienda } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, folio, fecha, hora FROM pedidos WHERE tienda = $1 ORDER BY id DESC',
      [idtienda]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pedidos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener detalles de un pedido
app.get('/detallesPedido/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT nombre, precio FROM detalles_pedido WHERE id_pedido = $1',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// Editar producto
app.put('/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, descripcion,sucursal } = req.body;

  try {
    await pool.query(
      'UPDATE productos SET nombre=$1, precio=$2, descripcion=$3 WHERE id=$4',
      [nombre, precio, descripcion, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto
app.delete('/productos/:id', async (req, res) => {
  const { id } = req.params;
  console.log('ID recibido para eliminar:', id);
  const related = await pool.query('SELECT * FROM protiendas WHERE idproducto = $1', [id]);
  console.log('Registros relacionados en protiendas:', related.rows);

  try {
    console.log(`Eliminando producto con ID ${id} de protiendas y productos`);

    // Elimina primero de protiendas
    await pool.query('DELETE FROM protiendas WHERE idproducto = $1', [id]);

    // Luego elimina de productos
    await pool.query('DELETE FROM productos WHERE id = $1', [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: err.message });
  }
});






//Obtener productos de cada tienda por id del trabador o tienda-----------------
app.get('/productosTienda/:idtienda', async (req, res) => {
  const { idtienda } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM protiendas WHERE idtienda = $1',
      [idtienda]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ error: err.message });
  }
});


//Obtener tiendas para cada producto---------------------------------
/**
app.get('/ObTienda',async(req,res)=>{

  const{tiendas}=req.body;

  try{
    const result=await pool.query('SELECT ')
  }

});
*/


// Inicia el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor backend funcionando en http://localhost:${PORT}`);
});
