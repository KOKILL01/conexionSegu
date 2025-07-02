const isAdmin = (req, res, next) => {
  
    const auth = req.headers.authorization;
  
    // Verifica si hay token tipo Bearer
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.split(' ')[1];
  
      // Simulación: solo permite si el token es "admin-token"
      if (token === 'admin-token') return next();
    }
  
    return res.status(401).json({ message: 'No autorizado' });
  }

  const isProovider = (req, res, next) => {
    if(auth && auth.startsWith('Bearer ')){
      const token = auth.split(' ')[1]; 
      if(token === 'proovider-token') return next(); 
    }

    return res.status(401).json({ message: 'No autorizado '}); 
  }
  
  module.exports = {
    isAdmin, 
    isProovider
  };