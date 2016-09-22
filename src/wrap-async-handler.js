export default (getPromise) => (req, res, next) => {
  getPromise(req, res, next).catch(next)
}
