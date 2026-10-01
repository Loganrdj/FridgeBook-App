import React, { useContext } from 'react';
import "./style.css";
import Inventory from "./Inventory"
import { GlobalContext } from '../context/GlobalState';

function Kitchen() {
    const { ingredients, ingredientsLoaded, deleteIngredient, updateIngredientQuantity } = useContext(GlobalContext);
    const fridge = ingredients.filter((ingredient) => ingredient.fridge_bool === true);
    const pantry = ingredients.filter((ingredient) => ingredient.fridge_bool !== true);

    return <div className="fade-in">
            <h1>Kitchen Page</h1>
            {ingredientsLoaded && ingredients.length === 0 &&
                <p className="kitchen-empty">Your kitchen is empty. Add items from the Dashboard.</p>}
                <div className="row">
                    <div className="col-md-6">
                        <Inventory name="Fridge" ingredients={fridge} delete={deleteIngredient} deleteAmount={updateIngredientQuantity}/>
                    </div>
                    <div className="col-md-6">
                        <Inventory name="Pantry" ingredients={pantry} delete={deleteIngredient} deleteAmount={updateIngredientQuantity}/>
                    </div>
                </div>
            </div>
}

export default Kitchen;
