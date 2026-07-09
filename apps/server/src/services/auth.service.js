export function createSession(user){
  return {
    user,
    token:'temporary-token'
  };
}
