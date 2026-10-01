import React, { useState, useContext } from 'react';
import axios from 'axios';
import RecipesList from './RecipesList';
import { GlobalContext } from '../context/GlobalState';
import { buildFallbackRecipes } from '../utils/recipeFallback';


const Main = () => {

  // function returnAll() {
  //   axios.get('/profile').then((response) => {
  //     if (response.data) {
  //       let kitchenArr = [];
  //       for(let i = 0; i < response.data.ingredients.length; i++){
  //         kitchenArr.push(response.data.ingredients[i].name);
  //       }
  //       return kitchenArr;
  //     }
  //   })
  // }

  const [message, setMessage] = useState(
    'Add ingredients then click "Fetch Recipes". Try to add as many ingredients as you can for better results.'
  );
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const { ingredients } = useContext(GlobalContext);

  var mergedIngredients = ingredients.map((ingredient) => {
    return encodeURIComponent(ingredient.value);
  });

  var encodedIngredients = mergedIngredients.join();

  const callDatabase = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const ingredientNames = ingredients.map((ingredient) => ingredient.value);
      const fallbackRecipes = buildFallbackRecipes(ingredientNames);
      setRecipes(fallbackRecipes);
      setLoading(false);
      setMessage('Showing local recipe suggestions while the old backend is unavailable.');
    } catch (err) {
      setLoading(false);
      setMessage('We could not load recipe suggestions right now.');
    }
  };

  const fetchRecipes = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const ingredientNames = ingredients.map((ingredient) => ingredient.value);
      const fallbackRecipes = buildFallbackRecipes(ingredientNames);
      setRecipes(fallbackRecipes);
      setLoading(false);

      if (fallbackRecipes.length === 0) {
        setMessage("Darn! Can't find any recipes. Try adding more ingredients.");
      } else {
        setMessage('');
      }
    } catch (err) {
      setLoading(false);
      setMessage('We could not load recipe suggestions right now.');
    }
  };

  return (
    <div className="lg:w-60vw lg:max-h-100vh lg:overflow-y-auto flex flex-col justify-between">
      <section className="py-16">
        <div className="px-8 max-w-5xl m-auto">
          <div className="border-b border-gray-400 pb-2 flex justify-between mb-6">
            <h2 className="font-bold text-gray-900 text-3xl">Recipes</h2>
            <button
              onClick={fetchRecipes}
              disabled={loading}
              className="px-3 py-2 rounded-md bg-black-500 text-white focus:outline-none hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? `Fetching Recipes` : `Fetch Recipes from search`}
            </button>
            <button
              onClick={callDatabase}
              disabled={loading}
              className="px-3 py-2 rounded-md bg-black-500 text-white focus:outline-none hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? `Searching...` : `What can I make?`}
            </button>
            
          </div>
          <p className="text-l">{message}</p>
          <RecipesList recipes={recipes} loading={loading} />
        </div>
      </section>
    </div>
  );
};

export default Main;


