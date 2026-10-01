import React, { Component } from 'react';
import "./style.css";
import Inventory from "./Inventory"
import { GlobalContext } from '../context/GlobalState';

class Kitchen extends Component{
    static contextType = GlobalContext;

    state = { 
        ingredients_fridge: undefined, 
        ingredients_pantry: undefined
    };

    componentDidMount() {
        this.updateIngredients();
    }

    updateIngredients = () => {
        const ingredients = this.context.ingredients || [];
        const kitchenArr = [];
        const pantryArr = [];

        for(let i = 0; i < ingredients.length; i++){
            if(ingredients[i].fridge_bool === true){
                kitchenArr.push(ingredients[i]);
            } else {
                pantryArr.push(ingredients[i]);
            }
        }

        this.setState({ ingredients_fridge: kitchenArr, ingredients_pantry: pantryArr });
    }

    removeIngredients = (id) => {
        this.context.deleteIngredient(id);
        this.updateIngredients();
    }

    deleteAmount = (id, quantity_to_delete) => {
        this.context.updateIngredientQuantity(id, quantity_to_delete);
        this.updateIngredients();
    }

    render(){
        return <div className="fade-in">
                <h1>Kitchen Page</h1>
                    <div className="row">
                        <div className="col-md-6">
                            <Inventory name="Fridge" ingredients={this.state.ingredients_fridge} delete={this.removeIngredients} deleteAmount={this.deleteAmount}/>
                        </div>
                        <div className="col-md-6">
                            <Inventory name="Pantry" ingredients={this.state.ingredients_pantry} delete={this.removeIngredients} deleteAmount={this.deleteAmount}/>
                        </div>
                    </div>
                </div>
    }
}


export default Kitchen;
